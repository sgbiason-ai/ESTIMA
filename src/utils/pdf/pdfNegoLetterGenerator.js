// src/utils/pdf/pdfNegoLetterGenerator.js
// Génère le courrier de négociation PDF avec jsPDF (style Mazamet)
import { sanitizeFilename } from './pdfSharedHelpers';

const FONT = 'helvetica';
const PAGE_W = 210;
const PAGE_H = 297;
const ML = 18; // marge gauche
const MR = 18; // marge droite
const MT = 15; // marge haut
const CONTENT_W = PAGE_W - ML - MR;

/**
 * Génère le courrier de négociation pour une entreprise
 * @param {Object} params
 * @param {string} params.companyName
 * @param {string} params.questions - texte brut des questions/prix atypiques
 * @param {Object} params.letterConfig - {city, deadline, signatoryName, adresseExpediteur, adresseEntreprise}
 * @param {Object} params.consultation - {objet, client, lieu, lot, moe, code, phase}
 */
export async function generateNegoLetterPDF({ companyName, questions, letterConfig, consultation }) {
  const { default: jsPDF } = await import('jspdf');

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const city = letterConfig.city || '[Ville]';
  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const deadline = letterConfig.deadline
    ? new Date(letterConfig.deadline).toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '[Date limite]';
  const signatory = letterConfig.signatoryName || '[Nom du signataire]';
  const objet = consultation?.objet || '[Objet du marché]';
  const client = consultation?.client || '[Nom du Client]';
  const lieu = consultation?.lieu || '[Lieu]';
  const adresseExp = letterConfig.adresseExpediteur || '';
  const adresseEnt = letterConfig.adresseEntreprise || '';

  let y = MT;

  // ── Helpers ──

  // Nettoyer les caractères non supportés par WinAnsiEncoding (Helvetica)
  // WinAnsi supporte : Latin-1 (U+00A0-00FF) + € œ Œ ƒ ˆ ˜ – — ' ' " " • … ‰ ‹ ›
  const clean = (text) => text
    .replace(/[\u202F\u2009\u200B]/g, ' ')         // espaces fines insécables → espace
    .replace(/\u00A0/g, ' ')                       // no-break space → espace
    .replace(/[\u2018\u2019\u2032]/g, "'")         // apostrophes typo → apostrophe simple
    .replace(/[\u201C\u201D]/g, '"')               // guillemets typo → guillemets droits
    .replace(/\u2026/g, '...');                    // ellipsis → trois points

  const setFont = (style = 'normal', size = 10) => {
    doc.setFont(FONT, style);
    doc.setFontSize(size);
  };

  const checkPage = (needed = 12) => {
    if (y + needed > PAGE_H - 15) {
      doc.addPage();
      y = MT;
    }
  };

  // Texte justifié multi-lignes (retour à la ligne auto)
  const writeJustified = (text, x, maxW, fontSize = 10, style = 'normal') => {
    setFont(style, fontSize);
    const lines = doc.splitTextToSize(clean(text), maxW);
    for (const line of lines) {
      checkPage(5);
      doc.text(line, x, y);
      y += fontSize * 0.42;
    }
  };

  // Texte avec segments gras intercalés : [{text, bold}]
  const writeMixedLine = (segments, x, maxW, fontSize = 10) => {
    // Construire le texte complet pour le word-wrap
    const fullText = segments.map(s => s.text).join('');
    setFont('normal', fontSize);
    const wrappedLines = doc.splitTextToSize(fullText, maxW);

    // Pour chaque ligne wrappée, recalculer les segments
    let charIndex = 0;
    for (const wLine of wrappedLines) {
      checkPage(5);
      let cx = x;
      let lineChars = wLine.length;
      let consumed = 0;

      for (const seg of segments) {
        if (consumed >= lineChars) break;
        const segStart = charIndex;
        const segEnd = charIndex + seg.text.length;

        // Portion de ce segment qui tombe dans cette ligne
        const overlapStart = Math.max(segStart, charIndex);
        const overlapEnd = Math.min(segEnd, charIndex + lineChars);

        if (overlapEnd > overlapStart) {
          // Offset dans le segment
          const relStart = overlapStart - segStart;
          const relEnd = overlapEnd - segStart;
          const portion = seg.text.substring(relStart, relEnd);

          setFont(seg.bold ? 'bold' : 'normal', fontSize);
          doc.text(portion, cx, y);
          cx += doc.getTextWidth(portion);
          consumed += portion.length;
        }
      }

      charIndex += lineChars;
      y += fontSize * 0.42;
    }
  };

  // ── 1. Date à droite ──
  setFont('normal', 10);
  const dateText = `${city}, le ${today}`;
  doc.text(clean(dateText), PAGE_W - MR, y, { align: 'right' });
  y += 8;

  // ── 2. Tableau DESTINATAIRE / EXPÉDITEUR ──
  const tableTop = y;
  const colGap = 3;
  const col1W = CONTENT_W * 0.55;
  const col2W = CONTENT_W - col1W - colGap;
  const col1X = ML;
  const col2X = ML + col1W + colGap;
  const headerH = 6;
  const cellPad = 3;

  // En-têtes
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);

  // Col 1 header
  doc.rect(col1X, tableTop, col1W, headerH);
  setFont('normal', 9);
  doc.text('DESTINATAIRE :', col1X + col1W / 2, tableTop + 4, { align: 'center' });

  // Col 2 header
  doc.rect(col2X, tableTop, col2W, headerH);
  doc.text(clean('EXPÉDITEUR :'), col2X + col2W / 2, tableTop + 4, { align: 'center' });

  // Contenu cellules
  const cellTop = tableTop + headerH;
  const lineH = 4;

  // Calculer hauteur des cellules (max des deux)
  setFont('bold', 10);
  const destLines = [companyName, ...adresseEnt.split('\n').filter(Boolean)];
  const expLines = [client, ...adresseExp.split('\n').filter(Boolean)];
  const maxLines = Math.max(destLines.length, expLines.length, 3);
  const cellH = cellPad * 2 + maxLines * lineH;

  // Col 1 body
  doc.rect(col1X, cellTop, col1W, cellH);
  let cy = cellTop + cellPad + 3.5;
  setFont('bold', 10);
  doc.text(clean(companyName), col1X + cellPad, cy);
  cy += lineH;
  setFont('normal', 9);
  for (const line of adresseEnt.split('\n').filter(Boolean)) {
    doc.text(clean(line), col1X + cellPad, cy);
    cy += lineH;
  }

  // Col 2 body
  doc.rect(col2X, cellTop, col2W, cellH);
  cy = cellTop + cellPad + 3.5;
  setFont('bold', 10);
  doc.text(clean(client), col2X + cellPad, cy);
  cy += lineH;
  setFont('normal', 9);
  for (const line of adresseExp.split('\n').filter(Boolean)) {
    doc.text(clean(line), col2X + cellPad, cy);
    cy += lineH;
  }

  y = cellTop + cellH + 6;

  // ── 3. OBJET ──
  setFont('bold', 10);
  checkPage(12);
  doc.text(clean(`OBJET :  ${objet}`), ML, y);
  y += 5;
  doc.text(clean('Négociation avec les candidats'), ML, y);
  y += 8;

  // ── 4. Cadre du corps ──
  const bodyStartY = y;
  // On dessine le cadre à la fin, après avoir calculé la hauteur
  // Pour l'instant, on avance dans le contenu avec un padding intérieur
  const bodyML = ML + 3;
  const bodyMR = MR + 3;
  const bodyW = PAGE_W - bodyML - bodyMR;

  // Monsieur,
  y += 3;
  setFont('normal', 10);
  doc.text('Monsieur,', bodyML, y);
  y += 7;

  // Paragraphe 1
  writeJustified(
    `Dans le cadre de la consultation relative au marché de travaux ${objet} à ${lieu}, votre entreprise a présenté une offre, laquelle a fait l'objet d'une analyse conformément aux critères et modalités définis au règlement de consultation.`,
    bodyML, bodyW
  );
  y += 3;

  // Paragraphe 2
  writeJustified(
    `Afin de permettre au pouvoir adjudicateur de vérifier la cohérence économique de votre offre au regard des prestations prévues au marché, et sans préjuger de la conformité ni du caractère de votre proposition, nous vous remercions de bien vouloir nous confirmer les prix des prestations suivantes :`,
    bodyML, bodyW
  );
  y += 3;

  // ── 5. Questions / Prix atypiques ──
  if (questions && questions.trim()) {
    const qLines = questions.split('\n').filter(l => l.trim());

    for (const line of qLines) {
      const trimmed = line.trim();

      // Titre de section (➡️ SUSPICION... ou PRIX PARAISSANT...)
      if (trimmed.startsWith('➡️') || trimmed.match(/^(SUSPICION|PRIX PARAISSANT)/i)) {
        checkPage(8);
        y += 2;
        const title = trimmed.replace(/^➡️\s*/, '');
        writeJustified(title, bodyML, bodyW, 10, 'bold');
        y += 1;
      }
      // Ligne de prix (- Prix n°... ou Prix n°...)
      else if (trimmed.match(/^-?\s*Prix\s+n/)) {
        checkPage(6);
        const cleaned = clean(trimmed.replace(/^-\s*/, ''));
        setFont('normal', 10);
        const bulletLines = doc.splitTextToSize(cleaned, bodyW - 6);
        for (let i = 0; i < bulletLines.length; i++) {
          checkPage(5);
          if (i === 0) {
            doc.text('-', bodyML + 1, y);
          }
          doc.text(bulletLines[i], bodyML + 6, y);
          y += 4;
        }
      }
      // Sous-item avec tiret
      else if (trimmed.startsWith('- ')) {
        checkPage(6);
        setFont('normal', 10);
        const itemText = clean(trimmed.substring(2));
        const bulletLines = doc.splitTextToSize(itemText, bodyW - 6);
        for (let i = 0; i < bulletLines.length; i++) {
          checkPage(5);
          if (i === 0) {
            doc.text('-', bodyML + 1, y);
          }
          doc.text(bulletLines[i], bodyML + 6, y);
          y += 4;
        }
      }
      // Articles concernés
      else if (trimmed.match(/^Articles\s+concern/i)) {
        checkPage(6);
        y += 1;
        writeJustified(clean(trimmed), bodyML, bodyW, 10, 'bold');
      }
      // Paragraphe normal
      else {
        checkPage(6);
        writeJustified(clean(trimmed), bodyML, bodyW);
      }
    }
    y += 3;
  }

  // ── 6. Paragraphes de négociation ──
  checkPage(20);
  writeJustified(
    'Par ailleurs, conformément aux règles applicables aux marchés passés selon une procédure adaptée, le pouvoir adjudicateur a décidé d\'engager une phase de négociation portant sur les aspects financiers de votre offre.',
    bodyML, bodyW
  );
  y += 3;

  checkPage(20);
  writeJustified(
    'Dans ce cadre, nous vous invitons à bien vouloir réexaminer le montant de votre proposition financière et à nous faire parvenir, le cas échéant, une offre financière révisée, intégrant une remise sur le prix initialement proposé, tout en maintenant le niveau de prestations et les dispositions techniques décrites dans votre mémoire technique.',
    bodyML, bodyW
  );
  y += 3;

  checkPage(12);
  writeJustified(
    'Cette phase de négociation a pour objet de permettre l\'optimisation de l\'économie générale du marché, sans modification des caractéristiques essentielles du lot ni des exigences du dossier de consultation.',
    bodyML, bodyW
  );
  y += 3;

  // Date limite (avec surlignage jaune)
  checkPage(12);
  setFont('normal', 10);
  const dlPart1 = 'Les éléments demandés devront être transmis sur la plateforme au plus tard le ';
  const dlPart2 = deadline;
  const dlPart3 = ', et seront intégrés à l\'analyse des offres avant toute décision d\'attribution.';
  const fullDL = clean(dlPart1 + dlPart2 + dlPart3);
  const cleanDeadline = clean(deadline);
  const dlLines = doc.splitTextToSize(fullDL, bodyW);

  for (const dLine of dlLines) {
    checkPage(5);
    // Vérifier si cette ligne contient la date limite pour surligner
    const dlIdx = dLine.indexOf(cleanDeadline);
    if (dlIdx >= 0) {
      setFont('normal', 10);
      const before = dLine.substring(0, dlIdx);
      const after = dLine.substring(dlIdx + cleanDeadline.length);
      let dx = bodyML;

      if (before) {
        doc.text(before, dx, y);
        dx += doc.getTextWidth(before);
      }
      // Surlignage jaune
      setFont('bold', 10);
      const dlW = doc.getTextWidth(cleanDeadline);
      doc.setFillColor(255, 255, 0);
      doc.rect(dx - 0.5, y - 3.2, dlW + 1, 4.2, 'F');
      doc.text(cleanDeadline, dx, y);
      dx += dlW;

      if (after) {
        setFont('normal', 10);
        doc.text(after, dx, y);
      }
    } else {
      setFont('normal', 10);
      doc.text(dLine, bodyML, y);
    }
    y += 4;
  }
  y += 3;

  // Formule de politesse
  checkPage(8);
  writeJustified(
    'Nous vous prions d\'agréer, Monsieur, l\'expression de nos salutations distinguées.',
    bodyML, bodyW
  );
  y += 10;

  // Signataire (indenté à droite)
  checkPage(8);
  setFont('normal', 10);
  doc.text(clean(signatory), ML + CONTENT_W * 0.55, y);
  y += 15;

  // ── 7. Cadre du corps (on le dessine sur toutes les pages) ──
  // Pour simplifier, on dessine le cadre sur la première page
  // du bodyStartY jusqu'à y (ou bas de page si multi-page)
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    if (p === 1 && totalPages === 1) {
      doc.rect(ML, bodyStartY, CONTENT_W, y - bodyStartY + 3);
    } else if (p === 1) {
      doc.rect(ML, bodyStartY, CONTENT_W, PAGE_H - 12 - bodyStartY);
    } else if (p === totalPages) {
      doc.rect(ML, MT - 3, CONTENT_W, y - MT + 6);
    } else {
      doc.rect(ML, MT - 3, CONTENT_W, PAGE_H - 12 - MT + 3);
    }
  }

  // Revenir à la dernière page
  doc.setPage(totalPages);

  // ── 8. Pied de page ──
  y += 6;
  if (y > PAGE_H - 15) y = PAGE_H - 12;
  setFont('normal', 8);
  doc.text(`NOMBRE DE PAGES (y compris celle-ci) : ${totalPages}`, ML, Math.min(y, PAGE_H - 8));

  // ── Sauvegarder ──
  const safeName = sanitizeFilename(companyName);
  doc.save(`Courrier_Negociation_${safeName}.pdf`);
}
