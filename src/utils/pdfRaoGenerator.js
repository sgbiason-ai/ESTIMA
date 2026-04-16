// src/utils/pdfRaoGenerator.js
// Génère le PDF du Rapport d'Analyse des Offres (RAO)
// INCLUT l'Analyse Financière (Synthèse A4 + Détails A3) avec codes couleurs par entreprise
// Style : Vert Papyrus — typographie H1 14pt / H2 12pt / body 9pt — marges 15mm

import { DEFAULT_CRITERIA, DEFAULT_ADMIN_PIECES, DEFAULT_OFFER_PIECES } from '../hooks/useRao';
import { normalizeUnitSymbol } from './helpers';
import { formatNumberFr, cleanText, loadLogos, renderLogo, drawCoverPage as _drawCoverPage } from './pdf/pdfSharedHelpers';
import { buildTheme as _buildTheme } from './pdf/buildTheme';

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
  if (delta < -0.00) return { fill: [209, 250, 229], text: [30, 41, 59] };
  return null;
};

// ─── HELPERS VISUELS ────────────────────────────────────────────────────────
// Barre de score CARRÉE (pas arrondie)
const drawScoreBar = (doc, x, y, w, h, score, maxScore, color) => {
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
  // Texte centré dans la barre
  const fs = h > 5 ? 7 : 5.5;
  doc.setFontSize(fs);
  doc.setFont('Helvetica', 'bold');
  const textY = y + h / 2 + fs * 0.13;
  const textX = pct > 0.15 ? x + (w * pct) / 2 : x + w * pct + 4;
  doc.setTextColor(pct > 0.4 ? 255 : 60, pct > 0.4 ? 255 : 60, pct > 0.4 ? 255 : 60);
  doc.text(fmtScore(score), textX, textY, { align: 'center' });
  doc.setTextColor(0, 0, 0);
};

// ─── CONSTANTES LAYOUT ─────────────────────────────────────────────────────
const M = 15; // marge standard 15mm

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
    } catch(e) {}
  }

  _drawCoverPage(doc, {
    docType: "RAPPORT D'ANALYSE DES OFFRES",
    title: consultation?.objet || project?.name,
    subtitle1: (consultation?.subtitle1 || project?.subtitle1 || '').trim(),
    subtitle2: (consultation?.subtitle2 || project?.subtitle2 || '').trim(),
    phaseLabel: (consultation?.phase || project?.phase || 'DCE').toUpperCase(),
    clientName: consultation?.client || project?.client || 'Non renseigné',
    clientStreet: project?.clientAddress ? project.clientAddress.trim() : '',
    clientCityZip: [project?.clientZip, project?.clientCity].filter(Boolean).join(' ').trim(),
    locationRaw: consultation?.lieu || project?.location || 'Non renseignée',
    codeAffaire: consultation?.code || project?.code || 'Non défini',
    showSignatures: project?.showSignatures !== false,
    signatories: project?.signatories || ['', '', '', ''],
    branding,
    today,
    extraBlocks: [{
      height: 40,
      rows: [
        { label: 'PROCÉDURE', value: consultation?.procedure || '—', col: 1 },
        { label: 'LOT', value: consultation?.lot || '—', col: 2 },
        { label: 'DATE LIMITE REMISE', value: remiseStr, col: 1 },
      ],
    }],
  }, THEME, { logoMoe, logoClient });
};

// ── EN-TÊTE : bande verte pleine + titre blanc ────────────────────────────
const drawHeader = (doc, title, consultation, project, THEME, logoMoe) => {
  const W = doc.internal.pageSize.getWidth();

  // Bande latérale verte
  doc.setFillColor(...THEME.primary);
  doc.rect(0, 0, 6, doc.internal.pageSize.getHeight(), 'F');

  // Bandeau header : fond vert plein avec texte blanc
  doc.setFillColor(...THEME.primary);
  doc.rect(0, 0, W, 22, 'F');

  if (logoMoe) {
    const maxW = 30; const maxH = 12;
    const ratio = logoMoe.width / logoMoe.height;
    let w = maxW; let h = w / ratio;
    if (h > maxH) { h = maxH; w = h * ratio; }
    doc.addImage(logoMoe, 'JPEG', W - M - w, 5, w, h);
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(12); // H2
  doc.text(title.toUpperCase(), M, 10);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.text((consultation?.objet || project?.name || '').toUpperCase(), M, 17);
};

// ── PIED DE PAGE : Réf + Date + Page ──────────────────────────────────────
const drawFooter = (doc, pageNum, consultation, project, THEME) => {
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
  doc.text(`Page ${pageNum}`, W - M, H - 9, { align: 'right' });
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
    project, consultation, criteria, rao, analysisCompanies, scores, ranking, branding,
    analysisStats, chaptersData, bpuRefMap, activeTrancheId, tranches, analysisMode, scoringConfig
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

  const addPage = (sectionTitle_, format = 'a4', orientation = 'portrait') => {
    doc.addPage(format, orientation);
    pageNum++;
    drawHeader(doc, sectionTitle_, consultation, project, THEME, logoMoe);
    drawFooter(doc, pageNum, consultation, project, THEME);
    return 30; // espace après header standardisé
  };

  // ── PAGE 1 : COUVERTURE ──
  drawCoverPageRao(doc, project, consultation, logoMoe, logoClient, today, branding, THEME);

  // ── PAGE 2 : SOMMAIRE ──
  // On insère une page placeholder pour le sommaire — on la remplira à la fin
  const sommairePage = pageNum + 1;
  doc.addPage('a4', 'portrait');
  pageNum++;
  drawHeader(doc, 'Sommaire', consultation, project, THEME, logoMoe);
  drawFooter(doc, pageNum, consultation, project, THEME);
  // On garde la référence de cette page pour la remplir plus tard
  const sommairePageIndex = doc.internal.getNumberOfPages();

  // ── PAGE 3 : OBJET + CRITÈRES ──
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
      } catch(e) {}
  }
  doc.text(remiseStr, W / 2, y + 10, { align: 'center' });
  y += 18;

  // Section 3 (Négociations) supprimée — les négociations sont exclues du PDF RAO.

  // Section 4 : Critères de notation
  tocEntries.push({ label: '4. Rappel des critères de notation', page: pageNum });
  y = sectionTitle(doc, '4  Rappel des critères de notation', y, THEME.primary);
  const criteriaBody = [];
  criteria.forEach((c, i) => {
    const hasSubs = (c.subCriteria || []).length > 0;
    const weight = c.auto ? (scoringConfig?.maxScore || c.weight) : (hasSubs ? c.subCriteria.reduce((s, sc) => s + (Number(sc.weight) || 0), 0) : c.weight);
    criteriaBody.push([
      { content: `Critère ${i + 1}`, styles: { fontStyle: 'bold' } },
      { content: c.label + (!hasSubs && c.description ? '\n' + c.description : ''), styles: { fontStyle: 'bold' } },
      { content: weight + '%', styles: { fontStyle: 'bold' } },
    ]);
    if (hasSubs) {
      c.subCriteria.forEach((sc, si) => {
        criteriaBody.push([
          { content: `  ${i + 1}.${si + 1}`, styles: { textColor: [100, 100, 100] } },
          { content: sc.label + (sc.description ? '\n' + sc.description : ''), styles: { textColor: [80, 80, 80], fontSize: 7 } },
          { content: (sc.weight || 0) + '%', styles: { textColor: [100, 100, 100] } },
        ]);
      });
    }
  });
  autoTable(doc, {
    startY: y,
    head: [['Critère', 'Intitulé', 'Pondération']],
    body: criteriaBody,
    styles: { font: 'Helvetica', fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: THEME.primary, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 22 }, 2: { cellWidth: 22, halign: 'center' } },
    alternateRowStyles: { fillColor: THEME.tableAlt },
    margin: { left: M, right: M },
    didDrawPage: () => drawFooter(doc, pageNum, consultation, project, THEME),
  });
  y = doc.lastAutoTable.finalY + 10;

  // ── PAGE : RÉPONSES REÇUES ──
  y = addPage('Réponses reçues', 'a4', 'portrait');
  tocEntries.push({ label: '5. Réponses reçues', page: pageNum });
  y = sectionTitle(doc, '5  Réponses reçues', y, THEME.primary);

  // Calculer la position X alignée pour toutes les pastilles (après le nom le plus long)
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  const maxNameW = Math.max(...companyNames.map(n => doc.getTextWidth(`-  ${n}`)));
  const pastilleAlignX = 25 + maxNameW + 6;

  companyNames.forEach((name, idx) => {
    const cStyle = getCompanyStyle(idx);
    const admin = companiesData[name]?.admin || {};
    const concl = admin.conclusion || 'reguliere';
    const conclLabels = { reguliere: 'RÉGULIÈRE', irreguliere: 'IRRÉGULIÈRE', inacceptable: 'INACCEPTABLE', inappropriee: 'INAPPROPRIÉE' };
    const conclColors = { reguliere: THEME.yes, irreguliere: [255, 140, 0], inacceptable: THEME.no, inappropriee: THEME.no };

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...cStyle.header);
    doc.text(`-  ${name}`, 25, y + 4);

    // Pastille conclusion — alignée verticalement
    const conclText = conclLabels[concl] || 'RÉGULIÈRE';
    const conclW = doc.getTextWidth(conclText) + 6;
    doc.setFillColor(...(conclColors[concl] || THEME.yes));
    doc.roundedRect(pastilleAlignX, y, conclW, 6, 1.5, 1.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(6);
    doc.text(conclText, pastilleAlignX + conclW / 2, y + 4.2, { align: 'center' });

    // Membres groupement
    if (admin.isGroupement && admin.groupementMembers?.length > 0) {
      y += 7;
      admin.groupementMembers.forEach(m => {
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...THEME.lightText);
        doc.text(`     ${m.role || 'Cotraitant'} : ${m.name || '—'}`, 30, y + 3);
        y += 5;
      });
    }
    y += 8;
  });

  // ── ANALYSE ADMINISTRATIVE — Tableau comparatif avec colonnes subdivisées pour groupements ──
  {
    y = addPage('Analyse administrative', 'a4', 'portrait');
    tocEntries.push({ label: '6. Analyse administrative', page: pageNum });
    y = sectionTitle(doc, '6  ANALYSE ADMINISTRATIVE — PIÈCES DE CANDIDATURE', y, THEME.primary);

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
    const colW = Math.max(10, Math.min(20, (W - 2 * M - 50) / subColumns.length));

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

    // Ligne conclusion (span si groupement)
    const conclRow = [{ content: 'CONCLUSION', styles: { fontStyle: 'bold' } }];
    companyNames.forEach(name => {
      const admin = companiesData[name]?.admin || {};
      const concl = admin.conclusion || 'reguliere';
      const label = conclLabelsA[concl] || 'RÉGULIÈRE';
      const memberCount = (admin.isGroupement && admin.groupementMembers?.length > 0) ? admin.groupementMembers.length : 1;
      conclRow.push(memberCount > 1 ? { content: label, colSpan: memberCount, styles: { halign: 'center' } } : label);
    });
    adminBody.push(conclRow);

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
      styles: { font: 'Helvetica', fontSize: 6.5, cellPadding: 2 },
      headStyles: { fillColor: THEME.primary, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6 },
      columnStyles: { 0: { cellWidth: 50, fontSize: 6.5 }, ...compColStyles },
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

  // ── ANALYSE FINANCIÈRE ──
  if (analysisStats && analysisCompanies.length > 0) {
    y = addPage('Analyse financière — Synthèse', 'a4', 'portrait');
    tocEntries.push({ label: '7. Synthèse de l\'analyse financière', page: pageNum });
    y = sectionTitle(doc, `7  SYNTHÈSE DE L'ANALYSE FINANCIÈRE`, y, THEME.primary);

    const maxScore = Number(scoringConfig?.maxScore || 40);
    const grandTotalBase = analysisStats.totalEstimation || 0;

    const summaryData = analysisCompanies.map(c => {
      const total = analysisStats.companiesTotals[c.id] || 0;
      const score = analysisStats.companyScores[c.id] || 0;
      const deviation = grandTotalBase > 0 ? ((total - grandTotalBase) / grandTotalBase) * 100 : 0;
      return { id: c.id, name: c.name, total, score, deviation };
    });
    summaryData.sort((a, b) => b.score - a.score);

    const summaryBody = summaryData.map((d, index) => {
      const origIdx = analysisCompanies.findIndex(c => c.name === d.name);
      const cStyle = getCompanyStyle(origIdx !== -1 ? origIdx : 0);
      const ttc = d.total * 1.2;
      return [
        { content: `${index + 1}${index === 0 ? 'er' : 'ème'}`, styles: { fontStyle: 'bold', halign: 'center' } },
        { content: d.name, styles: { textColor: cStyle.header, fontStyle: 'bold' } },
        { content: formatNumberFr(d.total) + ' €', styles: { fontStyle: 'bold', halign: 'right' } },
        { content: formatNumberFr(ttc) + ' €', styles: { halign: 'right' } },
        { content: (d.deviation > 0 ? '+' : '') + d.deviation.toFixed(2) + '%', styles: { textColor: d.deviation > 0 ? [200, 0, 0] : [0, 150, 0], halign: 'center' } },
        { content: d.score.toFixed(2) + ` / ${maxScore}`, styles: { fontStyle: 'bold', halign: 'center' } }
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
      drawScoreBar(doc, 55, y, barW, bHf, d.total, maxTotal, cStyle.header);
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

      trancheList.forEach((tranche, trancheIdx) => {
        const trLabel = hasTr ? tranche.name : 'Détail des Prix Unitaires';
        y = addPage(`Analyse financière — ${trLabel}`, 'a3', 'landscape');
        if (!tocAdded) {
          tocEntries.push({ label: '8. Détail des prix unitaires (A3)', page: pageNum });
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

        // Calcul totaux pour cette tranche
        let trEstTotal = 0;
        const trCompanyTotals = {};
        analysisCompanies.forEach(c => { trCompanyTotals[c.id] = 0; });
        trChapters.forEach(chap => {
          if (chap.isOption) return;
          chap.items.forEach(item => {
            trEstTotal += item.activeQty * (item.price || 0);
            analysisCompanies.forEach(c => {
              trCompanyTotals[c.id] += item.activeQty * Number(c.offers?.[item.id] ?? 0);
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

        analysisCompanies.forEach((company, idx) => {
          const style = getCompanyStyle(idx);
          mainHeaders.push({ content: company.name, colSpan: 3, styles: { halign: 'center', fillColor: style.header, fontStyle: 'bold', textColor: [255, 255, 255] } });
          subHeaders.push({ content: 'P.U.', styles: { halign: 'right', fillColor: style.body, textColor: style.text } });
          subHeaders.push({ content: 'Total', styles: { halign: 'right', fillColor: style.body, textColor: style.text } });
          subHeaders.push({ content: '%', styles: { halign: 'center', fillColor: style.body, textColor: style.text } });
          const startCol = 6 + (idx * 3);
          columnStyles[startCol] = { fillColor: style.body };
          columnStyles[startCol + 1] = { fillColor: style.body };
          columnStyles[startCol + 2] = { fillColor: style.body };
        });

        trChapters.forEach(chapter => {
          // Filtrer les articles avec quantité > 0 pour cette tranche
          const activeItems = chapter.items.filter(i => i.activeQty > 0);
          if (activeItems.length === 0) return;

          tableBody.push([{ content: chapter.title.toUpperCase(), colSpan: 6 + (analysisCompanies.length * 3), styles: { fillColor: [220, 220, 225], fontStyle: 'bold', textColor: [50, 50, 60] } }]);
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
            const itemPrices = analysisCompanies.map(c => Number(c.offers?.[item.id] || 0));
            const lineOabThreshold = analysisMode === 'oab' ? calculateOABThreshold(itemPrices) : 0;

            analysisCompanies.forEach((company) => {
              const priceVal = company.offers?.[item.id];
              const price = (priceVal !== undefined && priceVal !== null && priceVal !== "") ? Number(priceVal) : null;
              const hasPrice = price !== null;
              const total = hasPrice ? price * qty : 0;
              const deviation = (hasPrice && item.price > 0) ? ((price - item.price) / item.price) * 100 : 0;
              let cellStyle = {};
              if (analysisMode === 'oab' && hasPrice && price > 0 && price < lineOabThreshold) {
                cellStyle = { fillColor: [255, 237, 213], textColor: [180, 83, 9], fontStyle: 'bold' };
              } else if (analysisMode === 'heatmap' && hasPrice && item.price > 0) {
                const hs = getHeatmapStyle(price, item.price);
                if (hs) cellStyle = { fillColor: hs.fill, textColor: hs.text, fontStyle: 'bold' };
              }
              row.push({ content: hasPrice ? formatNumberFr(price) : '-', styles: { halign: 'right', ...cellStyle } });
              row.push({ content: hasPrice ? formatNumberFr(total) : '-', styles: { halign: 'right' } });
              row.push({ content: hasPrice ? (deviation > 0 ? '+' : '') + deviation.toFixed(0) + '%' : '-', styles: { halign: 'center', textColor: deviation > 0 ? [220, 38, 38] : [21, 128, 61], fontSize: 6 } });
            });
            tableBody.push(row);
          });

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
            analysisCompanies.forEach(company => {
              const totalChap = activeItems.reduce((acc, i) => { const p = Number(company.offers?.[i.id] || 0); return acc + (i.activeQty * p); }, 0);
              const deviation = chapEstTotal > 0 ? ((totalChap - chapEstTotal) / chapEstTotal) * 100 : 0;
              chapTotalRow.push({ content: '', styles: { fillColor: bgColor } });
              chapTotalRow.push({ content: formatNumberFr(totalChap), styles: { fontStyle: 'bold', halign: 'right', fillColor: bgColor } });
              chapTotalRow.push({ content: (deviation > 0 ? '+' : '') + deviation.toFixed(1) + '%', styles: { halign: 'center', fontSize: 7, fontStyle: 'bold', textColor: deviation > 0 ? [220, 38, 38] : [21, 128, 61], fillColor: bgColor } });
            });
            tableBody.push(chapTotalRow);
            tableBody.push([{ content: '', colSpan: 6 + (analysisCompanies.length * 3), styles: { cellPadding: 1, fillColor: [255, 255, 255] } }]);
          }
        });

        // Total HT tranche
        const colSpanTotal = 6 + (analysisCompanies.length * 3);
        const totalRow = [{ content: `TOTAL ${hasTr ? tranche.name.toUpperCase() : 'GÉNÉRAL'} HT`, colSpan: 4, styles: { fontStyle: 'bold', halign: 'right' } }, { content: '-', styles: { halign: 'center' } }, { content: formatNumberFr(trEstTotal), styles: { fontStyle: 'bold', halign: 'right', fillColor: [209, 250, 229] } }];
        analysisCompanies.forEach(company => {
          const total = trCompanyTotals[company.id] || 0;
          const deviation = trEstTotal > 0 ? ((total - trEstTotal) / trEstTotal) * 100 : 0;
          totalRow.push({ content: '-', styles: { halign: 'center' } });
          totalRow.push({ content: formatNumberFr(total), styles: { fontStyle: 'bold', halign: 'right', fillColor: [224, 231, 255] } });
          totalRow.push({ content: (deviation > 0 ? '+' : '') + deviation.toFixed(2) + '%', styles: { halign: 'center', fontStyle: 'bold' } });
        });
        tableBody.push(totalRow);

        // TVA 20%
        const tvaRate = 0.20;
        const tvaEstTotal = trEstTotal * tvaRate;
        const tvaRow = [{ content: 'TVA (20%)', colSpan: 4, styles: { fontStyle: 'bold', halign: 'right', fillColor: [245, 245, 250] } }, { content: '', styles: { fillColor: [245, 245, 250] } }, { content: formatNumberFr(tvaEstTotal), styles: { fontStyle: 'bold', halign: 'right', fillColor: [245, 245, 250] } }];
        analysisCompanies.forEach(company => {
          const total = trCompanyTotals[company.id] || 0;
          const tva = total * tvaRate;
          tvaRow.push({ content: '', styles: { fillColor: [245, 245, 250] } });
          tvaRow.push({ content: formatNumberFr(tva), styles: { fontStyle: 'normal', halign: 'right', fillColor: [245, 245, 250] } });
          tvaRow.push({ content: '', styles: { fillColor: [245, 245, 250] } });
        });
        tableBody.push(tvaRow);

        // Total TTC
        const ttcEstTotal = trEstTotal + tvaEstTotal;
        const ttcRow = [{ content: `TOTAL ${hasTr ? tranche.name.toUpperCase() : 'GÉNÉRAL'} TTC`, colSpan: 4, styles: { fontStyle: 'bold', halign: 'right', fillColor: [209, 250, 229] } }, { content: '', styles: { fillColor: [209, 250, 229] } }, { content: formatNumberFr(ttcEstTotal), styles: { fontStyle: 'bold', halign: 'right', fillColor: [209, 250, 229] } }];
        analysisCompanies.forEach(company => {
          const total = trCompanyTotals[company.id] || 0;
          const ttc = total * (1 + tvaRate);
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
          didDrawCell: (data) => {
            if (data.column.index >= 6 && (data.column.index - 6) % 3 === 0 && data.section === 'body') {
              const d = data.doc;
              d.setDrawColor(100, 100, 100); d.setLineWidth(0.3);
              d.line(data.cell.x, data.cell.y, data.cell.x, data.cell.y + data.cell.height);
            }
          },
          margin: { left: 10, right: 10 },
          didDrawPage: () => drawFooter(doc, pageNum, consultation, project, THEME),
        });
      }); // fin boucle tranches
    }
  }

  // ── ANALYSE TECHNIQUE — Regroupé par critère ──
  {
    const nonAutoCriteria = criteria.filter(c => !c.auto);
    if (nonAutoCriteria.length > 0) {
      y = addPage('Analyse technique', 'a4', 'portrait');
      tocEntries.push({ label: '9. Analyse technique', page: pageNum });

      nonAutoCriteria.forEach((crit, critIdx) => {
        if (y > 297 - 70) { y = addPage('Analyse technique', 'a4', 'portrait'); }
        const hasSubs = (crit.subCriteria || []).length > 0;

        // Header critère — fond vert avec poids
        y = sectionTitle(doc, `${crit.label}  (${crit.weight}%)`, y, THEME.primary);

        if (hasSubs) {
          crit.subCriteria.forEach((sc, si) => {
            if (y > 297 - 60) { y = addPage('Analyse technique', 'a4', 'portrait'); }
            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(...VERT_FONCE);
            doc.text(`${critIdx + 2}.${si + 1}  ${sc.label || 'Sous-critère'}  (${sc.weight || 0}%)`, M + 3, y + 3);
            y += 7;

            companyNames.forEach((name, ci) => {
              if (y > 297 - 25) { y = addPage('Analyse technique', 'a4', 'portrait'); }
              const cStyle = getCompanyStyle(ci);
              const tech = companiesData[name]?.technical || {};
              const sd = tech[sc.id] || {};
              const sNote = Number(sd.note || 0);
              const sMax = Number(sd.noteMax || 5);
              const sPond = sMax > 0 ? (sNote / sMax) * (Number(sc.weight) || 0) : 0;

              doc.setFont('Helvetica', 'bold');
              doc.setFontSize(7);
              doc.setTextColor(...cStyle.header);
              const bH = 5;
              doc.text(name, M + 5, y + bH / 2 + 1);
              drawScoreBar(doc, 68, y, W - 110, bH, sPond, sc.weight || 1, cStyle.header);
              doc.setTextColor(...THEME.text);
              doc.setFontSize(6.5);
              doc.text(`${sNote}/${sMax} = ${fmtScore(sPond)}`, W - M, y + bH / 2 + 1, { align: 'right' });
              y += bH + 4;

              if (sd.text) {
                doc.setFont('Helvetica', 'normal');
                doc.setFontSize(7.5);
                doc.setTextColor(...THEME.lightText);
                const lines = doc.splitTextToSize(sd.text, W - 2 * M - 10);
                let remaining = [...lines];
                while (remaining.length > 0) {
                  const maxL = Math.floor((297 - y - 20) / 3.8);
                  if (maxL <= 0) { y = addPage('Analyse technique', 'a4', 'portrait'); doc.setFont('Helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...THEME.lightText); continue; }
                  const batch = remaining.splice(0, maxL);
                  doc.text(batch, M + 10, y);
                  y += batch.length * 3.8 + 2;
                }
                y += 2;
              }
            });
            y += 6;
          });
        } else {
          companyNames.forEach((name, ci) => {
            if (y > 297 - 25) { y = addPage('Analyse technique', 'a4', 'portrait'); }
            const cStyle = getCompanyStyle(ci);
            const tech = companiesData[name]?.technical || {};
            const d = tech[crit.id] || {};
            const note = Number(d.note || 0);
            const noteMax = Number(d.noteMax || 5);
            const notePond = noteMax > 0 ? (note / noteMax) * crit.weight : 0;

            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(7);
            doc.setTextColor(...cStyle.header);
            const bH2 = 5;
            doc.text(name, M, y + bH2 / 2 + 1);
            drawScoreBar(doc, 68, y, W - 110, bH2, notePond, crit.weight, cStyle.header);
            doc.setTextColor(...THEME.text);
            doc.setFontSize(6.5);
            doc.text(`${note}/${noteMax} = ${fmtScore(notePond)}`, W - M, y + bH2 / 2 + 1, { align: 'right' });
            y += bH2 + 4;

            if (d.text) {
              doc.setFont('Helvetica', 'normal');
              doc.setFontSize(7.5);
              doc.setTextColor(...THEME.lightText);
              const lines = doc.splitTextToSize(d.text, W - 2 * M - 5);
              let remaining = [...lines];
              while (remaining.length > 0) {
                const maxL = Math.floor((297 - y - 20) / 3.8);
                if (maxL <= 0) { y = addPage('Analyse technique', 'a4', 'portrait'); doc.setFont('Helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...THEME.lightText); continue; }
                const batch = remaining.splice(0, maxL);
                doc.text(batch, M + 5, y);
                y += batch.length * 3.8 + 2;
              }
              y += 2;
            }
          });
        }
        y += 6;
      });

      // Tableau récap des notes techniques
      if (y > 297 - 50) { y = addPage('Analyse technique', 'a4', 'portrait'); }
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
  tocEntries.push({ label: '10. Récapitulatif général', page: pageNum });
  y = sectionTitle(doc, 'RÉCAPITULATIF GÉNÉRAL', y, THEME.primary);

  const priceC = criteria.find(c => c.auto) || criteria[0];
  const techCs = criteria.filter(c => !c.auto);

  const maxScorePrice = Number(scoringConfig?.maxScore || 50);
  const headCols = [
    'Entreprise',
    ...techCs.map(c => c.label.length > 25 ? c.label.slice(0, 25) + '...' : c.label),
    `C1 Prix\n/${maxScorePrice} pts`,
    'Prix HT',
    'Total\n/100',
    'Rang'
  ];

  const bodyRows = ranking.map((r) => [
    r.name.toUpperCase(),
    ...techCs.map(c => fmtScore(r.techScores?.[c.id] || 0)),
    fmtScore(r.priceScore || 0),
    fmt(r.price) + ' €',
    fmtScore(r.totalScore),
    `${r.rank}`,
  ]);

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
        const rank = parseInt(bodyRows[data.row.index][headCols.length - 1], 10);

        const rName = ranking[data.row.index].name;
        const originalIdx = analysisCompanies.findIndex(c => c.name === rName);
        const cStyle = getCompanyStyle(originalIdx !== -1 ? originalIdx : 0);

        if (data.column.index === 0) {
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
    },
    margin: { left: M, right: M },
    didDrawPage: () => drawFooter(doc, pageNum, consultation, project, THEME),
  });
  y = doc.lastAutoTable.finalY + 10;

  // ── Barres empilées (prix + technique) ──
  if (y < 297 - 60) {
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...VERT_FONCE);
    doc.text('VISUALISATION DES SCORES', M, y + 3);
    y += 8;
    const barMaxW = W - 80;
    ranking.forEach((r) => {
      if (y > 280) return;
      const origIdx = analysisCompanies.findIndex(c => c.name === r.name);
      const cStyle = getCompanyStyle(origIdx !== -1 ? origIdx : 0);
      const techTotal = Object.values(r.techScores || {}).reduce((a, b) => a + b, 0);
      const priceW = barMaxW * (r.priceScore || 0) / 100;
      const techW = barMaxW * techTotal / 100;

      const barH = 6;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(...cStyle.header);
      doc.text(r.name, M, y + barH / 2 + 6.5 * 0.13);

      // Fond gris
      doc.setFillColor(235, 235, 240);
      doc.rect(55, y, barMaxW, barH, 'F');
      // Barre prix (vert papyrus)
      if (priceW > 2) {
        doc.setFillColor(...VERT_PAPYRUS);
        doc.rect(55, y, priceW, barH, 'F');
        if (priceW > 12) {
          doc.setFont('Helvetica', 'bold'); doc.setFontSize(5.5); doc.setTextColor(255, 255, 255);
          doc.text(fmtScore(r.priceScore || 0), 55 + priceW / 2, y + barH / 2 + 0.8, { align: 'center' });
        }
      }
      // Barre technique (bleu)
      if (techW > 2) {
        doc.setFillColor(59, 130, 246);
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

  // ── Recommandation conforme CCP ──
  const winner = ranking[0];
  if (winner) {
    if (y > 265) { y = addPage('Récapitulatif général', 'a4', 'portrait'); }
    doc.setFillColor(...THEME.primary);
    doc.roundedRect(M, y, W - 2 * M, 22, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`Au regard des critères d'attribution définis dans les documents de consultation,`, W / 2, y + 6, { align: 'center' });
    doc.text(`l'offre de l'entreprise ${winner.name.toUpperCase()} est l'offre économiquement la plus avantageuse.`, W / 2, y + 12, { align: 'center' });
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Score : ${fmtScore(winner.totalScore)} / 100  —  Montant : ${fmt(winner.price)} € HT  —  ${fmt(winner.price * 1.2)} € TTC`, W / 2, y + 18, { align: 'center' });
  }

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

  const safeName = (consultation?.objet || project?.name || 'RAO').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 60);
  doc.save(`RAO_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`);
};
