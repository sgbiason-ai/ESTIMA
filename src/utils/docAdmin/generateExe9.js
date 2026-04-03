// src/utils/docAdmin/generateExe9.js
// Génération EXE9 — Propositions du Maître d'Œuvre et Décision du Maître de l'Ouvrage
//                    relatives à la Levée des Réserves
// Conforme au formulaire officiel (DAJ - mise à jour 01/04/2019)
import { saveAs } from 'file-saver';
import { loadMoeSignatureWithDimensions } from './moeDefaults.js';

const dots = (n = 40) => '.'.repeat(n);
const formatDate = (s) => {
  if (!s) return dots(20);
  try { return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch { return s; }
};

const CHK = '\u2612';
const UNCHK = '\u2610';

// ─── EXPORT PDF ─────────────────────────────────────────────────────────────
export const exportExe9Pdf = async (fiche, rawData) => {
  const data = { ...rawData };
  if (!data.exe9_lieuSignatureMoe) data.exe9_lieuSignatureMoe = 'BANNIERES';
  if (!data.exe9_lieuSignatureMO) data.exe9_lieuSignatureMO = fiche.sectionA?.ville || '';

  const { default: jsPDF } = await import('jspdf');

  const A = fiche.sectionA || {}, B = fiche.sectionB || {}, C = fiche.sectionC || {}, D = fiche.sectionD || {};
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth(), pageH = pdf.internal.pageSize.getHeight();
  const mL = 20, mR = 20, cW = pageW - mL - mR;
  let y = 18;
  const GRAY = [217, 217, 217], BLACK = [0, 0, 0];
  const FN = 10, FS = 9, FT = 11, LH = 5;

  const checkPage = (n = 20) => { if (y + n > pageH - 20) { pdf.addPage(); y = 18; } };
  const drawSectionTitle = (letter, title) => {
    const fullText = `${letter} - ${title}`;
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(FT);
    const lines = pdf.splitTextToSize(fullText, cW - 6);
    const boxH = Math.max(8, lines.length * 5 + 3);
    checkPage(boxH + 6);
    pdf.setFillColor(...GRAY); pdf.setDrawColor(...BLACK); pdf.setLineWidth(0.4);
    pdf.rect(mL, y, cW, boxH, 'FD');
    pdf.setTextColor(...BLACK);
    lines.forEach((line, i) => { pdf.text(line, mL + 3, y + 5 + i * 5); });
    y += boxH + 4;
  };
  const writeText = (content, opts = {}) => {
    pdf.setFont('helvetica', opts.bold ? 'bold' : opts.italics ? 'italic' : 'normal');
    pdf.setFontSize(opts.size || FN); pdf.setTextColor(...BLACK);
    pdf.splitTextToSize(content, cW - (opts.indentLeft || 0)).forEach(line => {
      checkPage(LH + 2);
      pdf.text(line, opts.align === 'right' ? pageW - mR : mL + (opts.indentLeft || 0), y, { align: opts.align || 'left' });
      y += LH;
    });
    y += (opts.after || 1);
  };
  const drawCheckbox = (x, yPos, checked) => {
    const size = 3.5;
    pdf.setDrawColor(...BLACK); pdf.setLineWidth(0.3);
    pdf.rect(x, yPos - size + 0.5, size, size);
    if (checked) {
      pdf.setLineWidth(0.5);
      pdf.line(x + 0.5, yPos - size + 1, x + size - 0.5, yPos);
      pdf.line(x + size - 0.5, yPos - size + 1, x + 0.5, yPos);
    }
  };
  const writeCheckLine = (checked, label, opts = {}) => {
    const indent = opts.indentLeft || 12;
    const size = opts.size || FN;
    checkPage(LH + 4);
    const cbX = mL + indent;
    const textX = cbX + 6;
    const maxW = cW - indent - 6;
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(size); pdf.setTextColor(...BLACK);
    const lines = pdf.splitTextToSize(label, maxW);
    drawCheckbox(cbX, y, checked);
    lines.forEach((line, i) => {
      if (i > 0) checkPage(LH + 2);
      pdf.text(line, textX, y);
      y += LH;
    });
    y += (opts.after || 2);
  };
  const writeEntreprise = (ent) => {
    if (!ent) { writeText(dots(60)); return; }
    [ent.nomCommercial, ent.denominationSociale ? `(${ent.denominationSociale})` : '', ent.adresse,
      [ent.codePostal, ent.ville].filter(Boolean).join('  ')].filter(Boolean).forEach(p => writeText(p, { after: 0 }));
    y += 2;
  };

  // ── En-tête ──
  pdf.setDrawColor(...BLACK); pdf.setLineWidth(0.4); pdf.rect(mL, y, cW, 46);
  const codeColX = pageW - mR - 30;
  pdf.line(codeColX, y, codeColX, y + 46);
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(FN);
  pdf.text("MINIST\u00c8RE DE L'\u00c9CONOMIE ET DES FINANCES", mL + 4, y + 7);
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(FS);
  pdf.text('Direction des Affaires Juridiques', mL + 4, y + 12);
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(FT);
  pdf.text("MARCH\u00c9S PUBLICS", mL + 4, y + 20);
  pdf.setFontSize(FN); pdf.text("R\u00c9CEPTION DES TRAVAUX", mL + 4, y + 26);
  pdf.setFontSize(FS); pdf.setFont('helvetica', 'normal');
  const subtitleLines = pdf.splitTextToSize("PROPOSITIONS DU MA\u00ceITRE D'\u0152UVRE ET D\u00c9CISION DU MA\u00ceITRE DE L'OUVRAGE RELATIVES \u00c0 LA LEV\u00c9E DES R\u00c9SERVES", codeColX - mL - 8);
  subtitleLines.forEach((line, i) => { pdf.text(line, mL + 4, y + 32 + i * 4); });
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(16);
  pdf.text('EXE9', codeColX + 15, y + 25, { align: 'center' });
  y += 50;

  // A — Maître de l'ouvrage
  drawSectionTitle('A', "Identification du ma\u00eetre de l'ouvrage");
  [A.designation, A.adresse, [A.codePostal, A.ville].filter(Boolean).join('  ')].filter(Boolean).forEach(l => writeText(l, { after: 0 }));
  y += 8;

  // B — Titulaire
  drawSectionTitle('B', 'Identification du titulaire du march\u00e9 public');
  const cotraitantsB = Array.isArray(B.cotraitants) ? B.cotraitants.filter(c => c?.nomCommercial || c?.denominationSociale) : [];
  const allEntsB = [
    { ent: B.mandataire, label: cotraitantsB.length > 0 ? 'Mandataire' : null },
    ...cotraitantsB.map((cot, i) => ({ ent: cot, label: `Co-traitant ${i + 1}` })),
  ];

  if (allEntsB.length <= 1) {
    writeEntreprise(B.mandataire);
  } else {
    const nB = allEntsB.length;
    const gapB = 8;
    const colWB = (cW - gapB * (nB - 1)) / nB;

    const getLinesB = (ent, label) => {
      const lines = [];
      if (label) lines.push({ t: label, bold: true });
      [ent?.nomCommercial, ent?.denominationSociale ? `(${ent.denominationSociale})` : '', ent?.adresse,
        [ent?.codePostal, ent?.ville].filter(Boolean).join('  '),
        ent?.email ? `Email : ${ent.email}` : '',
        ent?.siret ? `SIRET : ${ent.siret}` : ''].filter(Boolean).forEach(t => lines.push({ t }));
      return lines;
    };

    const renderedColsB = allEntsB.map(({ ent, label }) => {
      const rendered = [];
      getLinesB(ent, label).forEach(line => {
        pdf.setFont('helvetica', line.bold ? 'bold' : 'normal');
        pdf.setFontSize(FN);
        pdf.splitTextToSize(line.t, colWB).forEach(l => rendered.push({ t: l, bold: line.bold || false }));
      });
      return rendered;
    });

    const maxRowsB = Math.max(...renderedColsB.map(c => c.length));
    checkPage(maxRowsB * LH + 6);
    const startYB = y;

    renderedColsB.forEach((lines, colIdx) => {
      const colX = mL + colIdx * (colWB + gapB);
      lines.forEach((line, li) => {
        pdf.setFont('helvetica', line.bold ? 'bold' : 'normal');
        pdf.setFontSize(FN);
        pdf.setTextColor(...BLACK);
        pdf.text(line.t, colX, startYB + li * LH);
      });
    });
    y = startYB + maxRowsB * LH + 4;
  }
  y += 8;

  // C
  drawSectionTitle('C', "Identification du ma\u00eetre d'\u0153uvre");
  writeEntreprise(C); y += 8;

  // D
  drawSectionTitle('D', 'Objet du march\u00e9 public');
  if (D.objet) writeText(D.objet, { after: 2 }); y += 5;

  // E — Objet de la levée des réserves
  drawSectionTitle('E', "Objet de la lev\u00e9e des r\u00e9serves");
  writeText("La lev\u00e9e des r\u00e9serves porte sur :", { after: 3 });
  writeCheckLine(data.porteeReception === 'globale',
    "la r\u00e9ception de l'ouvrage comportant les prestations suivantes :", { indentLeft: 12, after: 2 });
  if (data.porteeReception === 'globale' && D.objet) {
    writeText(D.objet, { size: FS, indentLeft: 18, after: 3 });
  }
  writeCheckLine(data.porteeReception === 'partielle',
    "la r\u00e9ception partielle de l'ouvrage relative aux prestations d\u00e9sign\u00e9es ci-dessous :", { indentLeft: 12, after: 2 });
  if (data.porteeReception === 'partielle' && data.designationPartielle) {
    writeText(data.designationPartielle, { size: FS, indentLeft: 18, after: 3 });
  }
  y += 5;

  // F — Propositions du maître d'œuvre relatives au procès-verbal de levée des réserves
  drawSectionTitle('F', "Propositions du ma\u00eetre d'\u0153uvre relatives au proc\u00e8s-verbal de lev\u00e9e des r\u00e9serves");

  writeText(`Au vu du proc\u00e8s-verbal de lev\u00e9e des r\u00e9serves, en date du ${formatDate(data.exe9_datePVLevee)} ;`, { after: 3 });
  writeText("je soussign\u00e9, ma\u00eetre d'\u0153uvre, propose :", { after: 5 });

  const propMoe = data.exe9_propositionMoe;

  // F.1 — rapporter
  writeCheckLine(propMoe === 'rapporter',
    `de rapporter la r\u00e9ception des travaux et prestations, l'ex\u00e9cution des \u00e9preuves mentionn\u00e9es dans la d\u00e9cision de r\u00e9ception des ouvrages du ${formatDate(data.exe9_dateDecisionReception)} n'ayant pas \u00e9t\u00e9 concluantes.`,
    { indentLeft: 12, after: 4 });

  // F.2 — lever toutes
  writeCheckLine(propMoe === 'lever_toutes',
    `de lever toutes les r\u00e9serves dont \u00e9tait assortie la d\u00e9cision de r\u00e9ception des ouvrages, intervenue le ${formatDate(data.exe9_dateDecisionReception)}.`,
    { indentLeft: 12, after: 4 });

  // F.3 — maintenir toutes
  writeCheckLine(propMoe === 'maintenir_toutes',
    `de maintenir l'ensemble des r\u00e9serves dont \u00e9tait assortie la d\u00e9cision de r\u00e9ception des ouvrages, intervenue le ${formatDate(data.exe9_dateDecisionReception)}.`,
    { indentLeft: 12, after: 4 });

  // F.4 — lever partielles
  writeCheckLine(propMoe === 'lever_partielles',
    `parmi les r\u00e9serves dont \u00e9tait assortie la d\u00e9cision de r\u00e9ception des ouvrages intervenue le ${formatDate(data.exe9_dateDecisionReception)}, de lever celles figurant dans l'annexe n\u00b0 ${data.exe9_annexeLevee || dots(12)} du pr\u00e9sent formulaire.`,
    { indentLeft: 12, after: 3 });

  // F.4 sub-items — maintien des réserves
  if (propMoe === 'lever_partielles') {
    writeText("Il est propos\u00e9 de maintenir les r\u00e9serves suivantes :", { indentLeft: 18, after: 3 });

    writeCheckLine(!!data.exe9_maintienEpreuves,
      `l'ex\u00e9cution des \u00e9preuves \u00e9num\u00e9r\u00e9es \u00e0 l'annexe n\u00b0 ${data.exe9_maintienEpreuvesAnnexe || dots(12)} ci-jointe.`,
      { indentLeft: 22, after: 3 });

    writeCheckLine(!!data.exe9_maintienTravaux,
      `l'ex\u00e9cution des travaux et prestations list\u00e9s \u00e0 l'annexe n\u00b0 ${data.exe9_maintienTravauxAnnexe || dots(12)} ci-jointe.`,
      { indentLeft: 22, after: 3 });

    writeCheckLine(!!data.exe9_maintienImperfections,
      `la correction des imperfections et malfa\u00e7ons indiqu\u00e9es \u00e0 l'annexe n\u00b0 ${data.exe9_maintienImperfectionsAnnexe || dots(12)} ci-jointe.`,
      { indentLeft: 22, after: 3 });

    writeCheckLine(!!data.exe9_maintienInstallations,
      `les installations de chantier doivent \u00eatre repli\u00e9es et les terrains et les lieux doivent \u00eatre remis en \u00e9tat, avant le ${formatDate(data.exe9_maintienInstallationsDate)}.`,
      { indentLeft: 22, after: 3 });

    writeCheckLine(!!data.exe9_maintienPose,
      `les conditions de pose des \u00e9quipements doivent \u00eatre mises en conformit\u00e9 avec les sp\u00e9cifications des fournisseurs, avant le ${formatDate(data.exe9_maintienPoseDate)}.`,
      { indentLeft: 22, after: 3 });
  }
  y += 5;

  // G — Signature du maître d'œuvre
  checkPage(50);
  drawSectionTitle('G', "Signature du ma\u00eetre d'\u0153uvre");
  y += 5;
  writeText(`A : ${data.exe9_lieuSignatureMoe || dots(25)}, le ${formatDate(data.exe9_dateSignatureMoe)}`, { align: 'right', after: 4 });
  writeText('Signature', { align: 'right', bold: true, after: 2 });

  // Image signature MOE
  const moeSig = await loadMoeSignatureWithDimensions();
  if (moeSig) {
    const sigMaxW = 45, sigMaxH = 25;
    const sigRatio = Math.min(sigMaxW / moeSig.width, sigMaxH / moeSig.height, 1);
    const sigW = moeSig.width * sigRatio;
    const sigH = moeSig.height * sigRatio;
    checkPage(sigH + 8);
    try { pdf.addImage(moeSig.dataUrl, 'JPEG', pageW - mR - sigW, y, sigW, sigH); } catch { /* skip */ }
    y += sigH + 2;
  } else {
    y += 10;
  }
  y += 10;

  // H — Décision du maître de l'ouvrage
  checkPage(60);
  drawSectionTitle('H', "D\u00e9cision du ma\u00eetre de l'ouvrage");

  writeText(`Au vu du proc\u00e8s-verbal de lev\u00e9e des r\u00e9serves, en date du ${formatDate(data.exe9_datePVLevee)}, et des propositions compl\u00e9mentaires pr\u00e9sent\u00e9es le ${formatDate(data.exe9_datePropositionsMoe)} par le ma\u00eetre d'\u0153uvre ;`, { after: 3 });
  writeText("le ma\u00eetre de l'ouvrage d\u00e9cide :", { after: 5 });

  const decisionMO = data.exe9_decisionMO;

  // H.1 — accepter
  writeCheckLine(decisionMO === 'accepter',
    "d'accepter toutes les propositions compl\u00e9mentaires du ma\u00eetre d'\u0153uvre relatives au proc\u00e8s-verbal de lev\u00e9e des r\u00e9serves.",
    { indentLeft: 12, after: 4 });

  // H.2 — ne pas retenir
  writeCheckLine(decisionMO === 'ne_pas_retenir',
    "de ne pas retenir les propositions compl\u00e9mentaires du ma\u00eetre d'\u0153uvre relatives au proc\u00e8s-verbal de lev\u00e9e des r\u00e9serves et de :",
    { indentLeft: 12, after: 3 });

  if (decisionMO === 'ne_pas_retenir') {
    const decSub = data.exe9_decisionSub;

    // H.2.1 — rapporter
    writeCheckLine(decSub === 'rapporter',
      `rapporter la r\u00e9ception des travaux et prestations, l'ex\u00e9cution des \u00e9preuves mentionn\u00e9es dans la d\u00e9cision de r\u00e9ception des ouvrages du ${formatDate(data.exe9_decisionDateReception)} n'ayant pas \u00e9t\u00e9 concluantes.`,
      { indentLeft: 18, after: 3 });

    // H.2.2 — lever toutes
    writeCheckLine(decSub === 'lever_toutes',
      `lever toutes les r\u00e9serves dont \u00e9tait assortie la d\u00e9cision de r\u00e9ception des ouvrages, intervenue le ${formatDate(data.exe9_decisionDateReception)}.`,
      { indentLeft: 18, after: 3 });

    // H.2.3 — maintenir toutes
    writeCheckLine(decSub === 'maintenir_toutes',
      `maintenir l'ensemble des r\u00e9serves dont \u00e9tait assortie la d\u00e9cision de r\u00e9ception des ouvrages, intervenue le ${formatDate(data.exe9_decisionDateReception)}.`,
      { indentLeft: 18, after: 3 });

    // H.2.4 — lever partielles
    writeCheckLine(decSub === 'lever_partielles',
      `parmi les r\u00e9serves dont \u00e9tait assortie la d\u00e9cision de r\u00e9ception des ouvrages intervenue le ${formatDate(data.exe9_decisionDateReception)}, lever celles figurant dans l'annexe n\u00b0 ${data.exe9_decisionAnnexeLevee || dots(12)} du pr\u00e9sent formulaire.`,
      { indentLeft: 18, after: 3 });

    // H.2.4 sub-items — maintien des réserves (décision MO)
    if (decSub === 'lever_partielles') {
      writeText("Il est d\u00e9cid\u00e9 de maintenir les r\u00e9serves suivantes :", { indentLeft: 24, after: 3 });

      writeCheckLine(!!data.exe9_decisionMaintienEpreuves,
        `l'ex\u00e9cution des \u00e9preuves \u00e9num\u00e9r\u00e9es \u00e0 l'annexe n\u00b0 ${data.exe9_decisionMaintienEpreuvesAnnexe || dots(12)} ci-jointe.`,
        { indentLeft: 28, after: 3 });

      writeCheckLine(!!data.exe9_decisionMaintienTravaux,
        `l'ex\u00e9cution des travaux et prestations list\u00e9s \u00e0 l'annexe n\u00b0 ${data.exe9_decisionMaintienTravauxAnnexe || dots(12)} ci-jointe.`,
        { indentLeft: 28, after: 3 });

      writeCheckLine(!!data.exe9_decisionMaintienImperfections,
        `la correction des imperfections et malfa\u00e7ons indiqu\u00e9es \u00e0 l'annexe n\u00b0 ${data.exe9_decisionMaintienImperfectionsAnnexe || dots(12)} ci-jointe.`,
        { indentLeft: 28, after: 3 });

      writeCheckLine(!!data.exe9_decisionMaintienInstallations,
        `les installations de chantier doivent \u00eatre repli\u00e9es et les terrains et les lieux doivent \u00eatre remis en \u00e9tat, avant le ${formatDate(data.exe9_decisionMaintienInstallationsDate)}.`,
        { indentLeft: 28, after: 3 });

      writeCheckLine(!!data.exe9_decisionMaintienPose,
        `les conditions de pose des \u00e9quipements doivent \u00eatre mises en conformit\u00e9 avec les sp\u00e9cifications des fournisseurs, avant le ${formatDate(data.exe9_decisionMaintienPoseDate)}.`,
        { indentLeft: 28, after: 3 });
    }
  }
  y += 5;

  // I — Signature du maître de l'ouvrage
  checkPage(50);
  drawSectionTitle('I', "Signature du ma\u00eetre de l'ouvrage");
  y += 5;
  writeText(`A : ${data.exe9_lieuSignatureMO || dots(25)}, le ${formatDate(data.exe9_dateSignatureMO)}`, { align: 'right', after: 18 });
  writeText('Signature', { align: 'right', bold: true, after: 2 });

  // Date de mise à jour
  checkPage(10);
  y += 5;
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8);
  pdf.text("Date de mise \u00e0 jour : 01/04/2019.", mL, y);

  pdf.save(`EXE9_${(fiche.nom || 'levee-reserves').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
  return 'pdf';
};

// ─── EXPORT DOCX ────────────────────────────────────────────────────────────
export const exportExe9Docx = async (fiche, rawData) => {
  const data = { ...rawData };
  if (!data.exe9_lieuSignatureMoe) data.exe9_lieuSignatureMoe = 'BANNIERES';
  if (!data.exe9_lieuSignatureMO) data.exe9_lieuSignatureMO = fiche.sectionA?.ville || '';

  const { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, VerticalAlign, ImageRun } = await import('docx');
  const FONT = 'Arial', SN = 20, SS = 18, ST = 22, SL = 28;
  const BT = { style: BorderStyle.SINGLE, size: 1, color: '000000' };
  const BN = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const SG = { type: ShadingType.SOLID, color: 'D9D9D9' };
  const text = (c, o = {}) => new TextRun({ text: c, font: FONT, size: o.size || SN, bold: o.bold || false, italics: o.italics || false, ...o });
  const para = (ch, o = {}) => new Paragraph({ children: Array.isArray(ch) ? ch : [ch], spacing: { after: o.after ?? 120 }, alignment: o.alignment || AlignmentType.LEFT, indent: o.indent, ...o });
  const emptyLine = (a = 60) => para([text('')], { after: a });
  const sectionTitle = (letter, title) => new Table({
    rows: [new TableRow({ children: [new TableCell({ children: [para([text(`${letter} - ${title}`, { bold: true, size: ST })], { after: 0 })], shading: SG, borders: { top: BT, bottom: BT, left: BT, right: BT }, verticalAlign: VerticalAlign.CENTER, width: { size: 100, type: WidthType.PERCENTAGE } })] })],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
  const chkLine = (condition, label, opts = {}) =>
    para([text(`${condition ? CHK : UNCHK}  ${label}`, { size: opts.size || SN })], { after: opts.after ?? 80, indent: { left: opts.indent ?? 400 } });

  const A = fiche.sectionA || {}, B = fiche.sectionB || {}, C = fiche.sectionC || {}, D = fiche.sectionD || {};
  const children = [];

  // Header
  children.push(new Table({
    rows: [new TableRow({ children: [
      new TableCell({
        children: [
          para([text("MINIST\u00c8RE DE L'\u00c9CONOMIE ET DES FINANCES", { bold: true })], { after: 40 }),
          para([text('Direction des Affaires Juridiques', { size: SS })], { after: 80 }),
          para([text("MARCH\u00c9S PUBLICS", { bold: true, size: ST })], { after: 40 }),
          para([text("R\u00c9CEPTION DES TRAVAUX", { bold: true })], { after: 60 }),
          para([text("PROPOSITIONS DU MA\u00ceITRE D'\u0152UVRE ET D\u00c9CISION DU MA\u00ceITRE DE L'OUVRAGE RELATIVES \u00c0 LA LEV\u00c9E DES R\u00c9SERVES", { size: SS })], { after: 0 }),
        ],
        borders: { top: BT, bottom: BT, left: BT, right: BN }, width: { size: 80, type: WidthType.PERCENTAGE },
      }),
      new TableCell({
        children: [emptyLine(200), para([text('EXE9', { bold: true, size: SL })], { alignment: AlignmentType.CENTER, after: 0 })],
        borders: { top: BT, bottom: BT, left: BN, right: BT },
        width: { size: 20, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER,
      }),
    ] })],
    width: { size: 100, type: WidthType.PERCENTAGE },
  }));
  children.push(emptyLine(80));

  // A — Maître de l'ouvrage
  children.push(sectionTitle('A', "Identification du ma\u00eetre de l'ouvrage"));
  [A.designation, A.adresse, [A.codePostal, A.ville].filter(Boolean).join(' ')].filter(Boolean).forEach(l => children.push(para([text(l)], { after: 40 })));
  children.push(emptyLine(200));

  // B — Titulaire
  children.push(sectionTitle('B', 'Identification du titulaire du march\u00e9 public'));
  const cotraitantsB_docx = Array.isArray(B.cotraitants) ? B.cotraitants.filter(c => c?.nomCommercial || c?.denominationSociale) : [];

  const getEntParas = (ent, label) => {
    const paras = [];
    if (label) paras.push(para([text(label, { bold: true, size: SS })], { after: 20 }));
    [ent?.nomCommercial, ent?.denominationSociale ? `(${ent.denominationSociale})` : '', ent?.adresse,
      [ent?.codePostal, ent?.ville].filter(Boolean).join('  '),
      ent?.email ? `Email : ${ent.email}` : '',
      ent?.siret ? `SIRET : ${ent.siret}` : ''].filter(Boolean)
      .forEach(l => paras.push(para([text(l)], { after: 20 })));
    return paras;
  };

  if (cotraitantsB_docx.length === 0) {
    getEntParas(B.mandataire, null).forEach(p => children.push(p));
  } else {
    const allEntsB_docx = [
      { ent: B.mandataire, label: 'Mandataire' },
      ...cotraitantsB_docx.map((cot, i) => ({ ent: cot, label: `Co-traitant ${i + 1}` })),
    ];
    const colPct = Math.floor(100 / allEntsB_docx.length);
    children.push(new Table({
      rows: [new TableRow({
        children: allEntsB_docx.map(({ ent, label }) => new TableCell({
          children: getEntParas(ent, label),
          borders: { top: BN, bottom: BN, left: BN, right: BN },
          width: { size: colPct, type: WidthType.PERCENTAGE },
        })),
      })],
      width: { size: 100, type: WidthType.PERCENTAGE },
    }));
  }
  children.push(emptyLine(200));

  // C
  children.push(sectionTitle('C', "Identification du ma\u00eetre d'\u0153uvre"));
  getEntParas(C, null).forEach(p => children.push(p));
  children.push(emptyLine(200));

  // D
  children.push(sectionTitle('D', 'Objet du march\u00e9 public'));
  if (D.objet) children.push(para([text(D.objet)], { after: 80 }));
  children.push(emptyLine(120));

  // E — Objet de la levée des réserves
  children.push(sectionTitle('E', "Objet de la lev\u00e9e des r\u00e9serves"));
  children.push(para([text("La lev\u00e9e des r\u00e9serves porte sur :")], { after: 80 }));

  children.push(chkLine(data.porteeReception === 'globale',
    "la r\u00e9ception de l'ouvrage comportant les prestations suivantes :", { indent: 400 }));
  if (data.porteeReception === 'globale' && D.objet) {
    children.push(para([text(D.objet, { size: SS })], { after: 80, indent: { left: 600 } }));
  }
  children.push(chkLine(data.porteeReception === 'partielle',
    "la r\u00e9ception partielle de l'ouvrage relative aux prestations d\u00e9sign\u00e9es ci-dessous :", { indent: 400 }));
  if (data.porteeReception === 'partielle' && data.designationPartielle) {
    children.push(para([text(data.designationPartielle, { size: SS })], { after: 80, indent: { left: 600 } }));
  }
  children.push(emptyLine(120));

  // F — Propositions du maître d'œuvre
  children.push(sectionTitle('F', "Propositions du ma\u00eetre d'\u0153uvre relatives au proc\u00e8s-verbal de lev\u00e9e des r\u00e9serves"));
  children.push(para([text(`Au vu du proc\u00e8s-verbal de lev\u00e9e des r\u00e9serves, en date du ${formatDate(data.exe9_datePVLevee)} ;`)], { after: 80 }));
  children.push(para([text("je soussign\u00e9, ma\u00eetre d'\u0153uvre, propose :")], { after: 120 }));

  const propMoe = data.exe9_propositionMoe;

  // F.1 — rapporter
  children.push(chkLine(propMoe === 'rapporter',
    `de rapporter la r\u00e9ception des travaux et prestations, l'ex\u00e9cution des \u00e9preuves mentionn\u00e9es dans la d\u00e9cision de r\u00e9ception des ouvrages du ${formatDate(data.exe9_dateDecisionReception)} n'ayant pas \u00e9t\u00e9 concluantes.`,
    { indent: 400 }));

  // F.2 — lever toutes
  children.push(chkLine(propMoe === 'lever_toutes',
    `de lever toutes les r\u00e9serves dont \u00e9tait assortie la d\u00e9cision de r\u00e9ception des ouvrages, intervenue le ${formatDate(data.exe9_dateDecisionReception)}.`,
    { indent: 400 }));

  // F.3 — maintenir toutes
  children.push(chkLine(propMoe === 'maintenir_toutes',
    `de maintenir l'ensemble des r\u00e9serves dont \u00e9tait assortie la d\u00e9cision de r\u00e9ception des ouvrages, intervenue le ${formatDate(data.exe9_dateDecisionReception)}.`,
    { indent: 400 }));

  // F.4 — lever partielles
  children.push(chkLine(propMoe === 'lever_partielles',
    `parmi les r\u00e9serves dont \u00e9tait assortie la d\u00e9cision de r\u00e9ception des ouvrages intervenue le ${formatDate(data.exe9_dateDecisionReception)}, de lever celles figurant dans l'annexe n\u00b0 ${data.exe9_annexeLevee || dots(15)} du pr\u00e9sent formulaire.`,
    { indent: 400 }));

  // F.4 sub-items
  if (propMoe === 'lever_partielles') {
    children.push(para([text("Il est propos\u00e9 de maintenir les r\u00e9serves suivantes :")], { after: 80, indent: { left: 600 } }));

    children.push(chkLine(!!data.exe9_maintienEpreuves,
      `l'ex\u00e9cution des \u00e9preuves \u00e9num\u00e9r\u00e9es \u00e0 l'annexe n\u00b0 ${data.exe9_maintienEpreuvesAnnexe || dots(15)} ci-jointe.`,
      { indent: 800 }));

    children.push(chkLine(!!data.exe9_maintienTravaux,
      `l'ex\u00e9cution des travaux et prestations list\u00e9s \u00e0 l'annexe n\u00b0 ${data.exe9_maintienTravauxAnnexe || dots(15)} ci-jointe.`,
      { indent: 800 }));

    children.push(chkLine(!!data.exe9_maintienImperfections,
      `la correction des imperfections et malfa\u00e7ons indiqu\u00e9es \u00e0 l'annexe n\u00b0 ${data.exe9_maintienImperfectionsAnnexe || dots(15)} ci-jointe.`,
      { indent: 800 }));

    children.push(chkLine(!!data.exe9_maintienInstallations,
      `les installations de chantier doivent \u00eatre repli\u00e9es et les terrains et les lieux doivent \u00eatre remis en \u00e9tat, avant le ${formatDate(data.exe9_maintienInstallationsDate)}.`,
      { indent: 800 }));

    children.push(chkLine(!!data.exe9_maintienPose,
      `les conditions de pose des \u00e9quipements doivent \u00eatre mises en conformit\u00e9 avec les sp\u00e9cifications des fournisseurs, avant le ${formatDate(data.exe9_maintienPoseDate)}.`,
      { indent: 800 }));
  }
  children.push(emptyLine(200));

  // G — Signature du maître d'œuvre
  children.push(sectionTitle('G', "Signature du ma\u00eetre d'\u0153uvre"));
  children.push(emptyLine(100));
  children.push(para([text(`A : ${data.exe9_lieuSignatureMoe || dots(25)}, le ${formatDate(data.exe9_dateSignatureMoe)}`)], { alignment: AlignmentType.RIGHT, after: 80 }));
  children.push(para([text('Signature', { bold: true })], { alignment: AlignmentType.RIGHT, after: 40 }));

  // Image signature MOE
  const moeSigDocx = await loadMoeSignatureWithDimensions();
  if (moeSigDocx) {
    try {
      const base64Data = moeSigDocx.dataUrl.split(',')[1];
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      const sigMaxW = 150, sigMaxH = 80;
      const sigRatio = Math.min(sigMaxW / moeSigDocx.width, sigMaxH / moeSigDocx.height, 1);
      children.push(new Paragraph({
        children: [new ImageRun({ data: bytes, transformation: { width: Math.round(moeSigDocx.width * sigRatio), height: Math.round(moeSigDocx.height * sigRatio) } })],
        alignment: AlignmentType.RIGHT, spacing: { after: 100 },
      }));
    } catch { /* skip */ }
  }
  children.push(emptyLine(200));

  // H — Décision du maître de l'ouvrage
  children.push(sectionTitle('H', "D\u00e9cision du ma\u00eetre de l'ouvrage"));
  children.push(para([text(`Au vu du proc\u00e8s-verbal de lev\u00e9e des r\u00e9serves, en date du ${formatDate(data.exe9_datePVLevee)}, et des propositions compl\u00e9mentaires pr\u00e9sent\u00e9es le ${formatDate(data.exe9_datePropositionsMoe)} par le ma\u00eetre d'\u0153uvre ;`)], { after: 80 }));
  children.push(para([text("le ma\u00eetre de l'ouvrage d\u00e9cide :")], { after: 120 }));

  const decisionMO = data.exe9_decisionMO;

  // H.1 — accepter
  children.push(chkLine(decisionMO === 'accepter',
    "d'accepter toutes les propositions compl\u00e9mentaires du ma\u00eetre d'\u0153uvre relatives au proc\u00e8s-verbal de lev\u00e9e des r\u00e9serves.",
    { indent: 400 }));

  // H.2 — ne pas retenir
  children.push(chkLine(decisionMO === 'ne_pas_retenir',
    "de ne pas retenir les propositions compl\u00e9mentaires du ma\u00eetre d'\u0153uvre relatives au proc\u00e8s-verbal de lev\u00e9e des r\u00e9serves et de :",
    { indent: 400 }));

  if (decisionMO === 'ne_pas_retenir') {
    const decSub = data.exe9_decisionSub;

    // H.2.1 — rapporter
    children.push(chkLine(decSub === 'rapporter',
      `rapporter la r\u00e9ception des travaux et prestations, l'ex\u00e9cution des \u00e9preuves mentionn\u00e9es dans la d\u00e9cision de r\u00e9ception des ouvrages du ${formatDate(data.exe9_decisionDateReception)} n'ayant pas \u00e9t\u00e9 concluantes.`,
      { indent: 600 }));

    // H.2.2 — lever toutes
    children.push(chkLine(decSub === 'lever_toutes',
      `lever toutes les r\u00e9serves dont \u00e9tait assortie la d\u00e9cision de r\u00e9ception des ouvrages, intervenue le ${formatDate(data.exe9_decisionDateReception)}.`,
      { indent: 600 }));

    // H.2.3 — maintenir toutes
    children.push(chkLine(decSub === 'maintenir_toutes',
      `maintenir l'ensemble des r\u00e9serves dont \u00e9tait assortie la d\u00e9cision de r\u00e9ception des ouvrages, intervenue le ${formatDate(data.exe9_decisionDateReception)}.`,
      { indent: 600 }));

    // H.2.4 — lever partielles
    children.push(chkLine(decSub === 'lever_partielles',
      `parmi les r\u00e9serves dont \u00e9tait assortie la d\u00e9cision de r\u00e9ception des ouvrages intervenue le ${formatDate(data.exe9_decisionDateReception)}, lever celles figurant dans l'annexe n\u00b0 ${data.exe9_decisionAnnexeLevee || dots(15)} du pr\u00e9sent formulaire.`,
      { indent: 600 }));

    // H.2.4 sub-items
    if (decSub === 'lever_partielles') {
      children.push(para([text("Il est d\u00e9cid\u00e9 de maintenir les r\u00e9serves suivantes :")], { after: 80, indent: { left: 800 } }));

      children.push(chkLine(!!data.exe9_decisionMaintienEpreuves,
        `l'ex\u00e9cution des \u00e9preuves \u00e9num\u00e9r\u00e9es \u00e0 l'annexe n\u00b0 ${data.exe9_decisionMaintienEpreuvesAnnexe || dots(15)} ci-jointe.`,
        { indent: 1000 }));

      children.push(chkLine(!!data.exe9_decisionMaintienTravaux,
        `l'ex\u00e9cution des travaux et prestations list\u00e9s \u00e0 l'annexe n\u00b0 ${data.exe9_decisionMaintienTravauxAnnexe || dots(15)} ci-jointe.`,
        { indent: 1000 }));

      children.push(chkLine(!!data.exe9_decisionMaintienImperfections,
        `la correction des imperfections et malfa\u00e7ons indiqu\u00e9es \u00e0 l'annexe n\u00b0 ${data.exe9_decisionMaintienImperfectionsAnnexe || dots(15)} ci-jointe.`,
        { indent: 1000 }));

      children.push(chkLine(!!data.exe9_decisionMaintienInstallations,
        `les installations de chantier doivent \u00eatre repli\u00e9es et les terrains et les lieux doivent \u00eatre remis en \u00e9tat, avant le ${formatDate(data.exe9_decisionMaintienInstallationsDate)}.`,
        { indent: 1000 }));

      children.push(chkLine(!!data.exe9_decisionMaintienPose,
        `les conditions de pose des \u00e9quipements doivent \u00eatre mises en conformit\u00e9 avec les sp\u00e9cifications des fournisseurs, avant le ${formatDate(data.exe9_decisionMaintienPoseDate)}.`,
        { indent: 1000 }));
    }
  }
  children.push(emptyLine(200));

  // I — Signature du maître de l'ouvrage
  children.push(sectionTitle('I', "Signature du ma\u00eetre de l'ouvrage"));
  children.push(emptyLine(100));
  children.push(para([text(`A : ${data.exe9_lieuSignatureMO || dots(25)}, le ${formatDate(data.exe9_dateSignatureMO)}`)], { alignment: AlignmentType.RIGHT, after: 200 }));
  children.push(para([text('Signature', { bold: true })], { alignment: AlignmentType.RIGHT, after: 40 }));

  children.push(emptyLine(200));
  // Pied de page
  children.push(para([text('Date de mise \u00e0 jour : 01/04/2019.', { size: 16 })], { after: 0 }));

  const doc = new Document({ sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 1080, right: 1080 } } }, children }] });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `EXE9_${(fiche.nom || 'levee-reserves').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.docx`);
};
