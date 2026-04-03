// src/utils/docAdmin/generateExe10.js
// Génération EXE10 — Avenant
// Conforme au formulaire officiel (DAJ - mise à jour 01/04/2019)
import { saveAs } from 'file-saver';

const loadMarianneImage = async () => {
  try {
    const res = await fetch('/marianne.jpg');
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

const dots = (n = 40) => '.'.repeat(n);
const blankDate = '___________________';
const formatDate = (s) => {
  if (!s) return blankDate;
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return blankDate;
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return blankDate; }
};

const formatMontant = (v) => {
  if (v === undefined || v === null || v === '') return dots(20);
  const n = parseFloat(v);
  if (isNaN(n)) return String(v);
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const CHK = '☒';
const UNCHK = '☐';

// ─── Helpers PDF communs ──────────────────────────────────────────────────
const createPdfHelpers = (pdf, pageW, pageH, mL, mR, cW) => {
  const BG_COLOR = [176, 224, 242], BLACK = [0, 0, 0]; // Bleu cyan #B0E0F2
  const FN = 10, FS = 9, FT = 11, LH = 5;
  let y = 18;

  const getY = () => y;
  const setY = (v) => { y = v; };
  const addY = (v) => { y += v; };

  const checkPage = (n = 20) => { if (y + n > pageH - 20) { pdf.addPage(); y = 18; } };

  // Titres de section (A, B, C...) : fond bleu AVEC bordure noire
  const drawSectionTitle = (letter, title) => {
    const fullText = `${letter} - ${title}`;
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(FT);
    const lines = pdf.splitTextToSize(fullText, cW - 6);
    const boxH = Math.max(8, lines.length * 5 + 3);
    checkPage(boxH + 6);
    pdf.setFillColor(...BG_COLOR);
    pdf.rect(mL, y, cW, boxH, 'F');
    pdf.setTextColor(...BLACK);
    lines.forEach((line, i) => { pdf.text(line, mL + 3, y + 5 + i * 5); });
    y += boxH + 4;
  };

  const writeText = (content, opts = {}) => {
    pdf.setFont('helvetica', opts.bold ? 'bold' : opts.italics ? 'italic' : 'normal');
    pdf.setFontSize(opts.size || FN); pdf.setTextColor(...BLACK);
    const maxW = cW - (opts.indentLeft || 0);
    pdf.splitTextToSize(content, maxW).forEach(line => {
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
      [ent.codePostal, ent.ville].filter(Boolean).join('  '),
      ent.email ? `Email : ${ent.email}` : '',
      ent.siret ? `SIRET : ${ent.siret}` : ''].filter(Boolean).forEach(p => writeText(p, { after: 0 }));
    y += 2;
  };

  return { getY, setY, addY, checkPage, drawSectionTitle, writeText, drawCheckbox, writeCheckLine, writeEntreprise, BG_COLOR, BLACK, FN, FS, FT, LH };
};

// ─── EXPORT PDF ─────────────────────────────────────────────────────────────
export const exportExe10Pdf = async (fiche, rawData) => {
  const data = { ...rawData };

  const MARIANNE_B64 = await loadMarianneImage();
  const { default: jsPDF } = await import('jspdf');

  const A = fiche.sectionA || {}, B = fiche.sectionB || {}, D = fiche.sectionD || {};
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth(), pageH = pdf.internal.pageSize.getHeight();
  const mL = 20, mR = 20, cW = pageW - mL - mR;

  const h = createPdfHelpers(pdf, pageW, pageH, mL, mR, cW);

  // ── En-tête (Design Fidèle DAJ avec logo et encadrement bleu SANS bordure) ──
  let currentY = h.getY();

  // 1. Logo Marianne centré en haut
  if (MARIANNE_B64 && MARIANNE_B64.length > 10) {
    const logoW = 35, logoH = 20;
    const logoX = (pageW - logoW) / 2;
    try { pdf.addImage(MARIANNE_B64, 'JPEG', logoX, currentY, logoW, logoH); } catch { /* skip */ }
    currentY += logoH + 5;
  }

  // 2. Textes Ministère centrés sous le logo
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(h.FN);
  pdf.text("MINISTÈRE DE L'ÉCONOMIE ET DES FINANCES", pageW / 2, currentY, { align: 'center' });
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(h.FS);
  pdf.text('Direction des Affaires Juridiques', pageW / 2, currentY + 5, { align: 'center' });

  currentY += 12;

  // 3. Le grand rectangle BLEU SANS BORDURE
  const boxTitleY = currentY;
  const boxTitleH = 26;
  const boxTitleW = cW;
  const boxTitleX = mL;

  pdf.setFillColor(...h.BG_COLOR);
  pdf.rect(boxTitleX, boxTitleY, boxTitleW, boxTitleH, 'F');

  // 4. Textes à l'intérieur du rectangle bleu
  pdf.setTextColor(...h.BLACK);
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(14);
  pdf.text('MARCHÉS PUBLICS', pageW / 2, boxTitleY + 8, { align: 'center' });

  pdf.setFontSize(11);
  pdf.text(`AVENANT N° ${data.numeroAvenant || dots(5)}`, pageW / 2, boxTitleY + 15, { align: 'center' });

  // EXE10 aligné à droite, dans le même rectangle bleu
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(22);
  pdf.text('EXE10', pageW - mR - 5, boxTitleY + 17, { align: 'right' });

  h.setY(boxTitleY + boxTitleH + 10);

  // ── Section A ──
  h.drawSectionTitle('A', "Identification du pouvoir adjudicateur ou de l'entité adjudicatrice");
  [A.designation, A.adresse, [A.codePostal, A.ville].filter(Boolean).join('  ')].filter(Boolean).forEach(l => h.writeText(l, { after: 0 }));
  h.addY(8);

  // ── Section B ──
  h.drawSectionTitle('B', 'Identification du titulaire du marché public');
  const cotraitantsB = Array.isArray(B.cotraitants) ? B.cotraitants.filter(c => c?.nomCommercial || c?.denominationSociale) : [];
  const allEntsB = [
    { ent: B.mandataire, label: cotraitantsB.length > 0 ? 'Mandataire' : null },
    ...cotraitantsB.map((cot, i) => ({ ent: cot, label: `Co-traitant ${i + 1}` })),
  ];

  if (allEntsB.length <= 1) {
    h.writeEntreprise(B.mandataire);
  } else {
    const n = allEntsB.length;
    const gap = 8;
    const colW = (cW - gap * (n - 1)) / n;

    const getLines = (ent, label) => {
      const lines = [];
      if (label) lines.push({ t: label, bold: true });
      [ent?.nomCommercial, ent?.denominationSociale ? `(${ent.denominationSociale})` : '', ent?.adresse,
        [ent?.codePostal, ent?.ville].filter(Boolean).join('  '),
        ent?.email ? `Email : ${ent.email}` : '',
        ent?.siret ? `SIRET : ${ent.siret}` : ''].filter(Boolean).forEach(t => lines.push({ t }));
      return lines;
    };

    const renderedCols = allEntsB.map(({ ent, label }) => {
      const rendered = [];
      getLines(ent, label).forEach(line => {
        pdf.setFont('helvetica', line.bold ? 'bold' : 'normal');
        pdf.setFontSize(h.FN);
        pdf.splitTextToSize(line.t, colW).forEach(l => rendered.push({ t: l, bold: line.bold || false }));
      });
      return rendered;
    });

    const maxRows = Math.max(...renderedCols.map(c => c.length));
    h.checkPage(maxRows * h.LH + 6);
    const startY = h.getY();

    renderedCols.forEach((lines, colIdx) => {
      const colX = mL + colIdx * (colW + gap);
      lines.forEach((line, li) => {
        pdf.setFont('helvetica', line.bold ? 'bold' : 'normal');
        pdf.setFontSize(h.FN);
        pdf.setTextColor(...h.BLACK);
        pdf.text(line.t, colX, startY + li * h.LH);
      });
    });
    h.setY(startY + maxRows * h.LH + 4);
  }
  h.addY(8);

  // ── Section C ──
  h.drawSectionTitle('C', 'Objet du marché public');
  h.writeText(`◼ Objet du marché public : ${D.objet || dots(50)}`, { after: 3 });
  h.writeText(`◼ Date de la notification du marché public : ${formatDate(data.dateNotificationMarche || D.dateNotification)}`, { after: 3 });
  h.writeText(`◼ Durée d'exécution du marché public : ${D.dureeExecution || dots(10)} ${D.uniteDuree || 'mois'}`, { after: 3 });
  h.writeText(`◼ Montant initial du marché public :`, { bold: true, after: 2 });
  h.writeText(`Taux de la TVA : ${data.montantInitialTVA !== undefined && data.montantInitialTVA !== '' ? data.montantInitialTVA : dots(10)} %`, { indentLeft: 12, after: 1 });
  h.writeText(`Montant HT : ${formatMontant(data.montantInitialHT)} €`, { indentLeft: 12, after: 1 });
  h.writeText(`Montant TTC : ${formatMontant(data.montantInitialTTC)} €`, { indentLeft: 12, after: 3 });
  h.addY(5);

  // ── Section D ──
  h.drawSectionTitle('D', "Objet de l'avenant");
  h.writeText(`◼ Modifications introduites par le présent avenant :`, { bold: true, after: 2 });
  h.writeText(data.modifications || dots(60), { indentLeft: 5, after: 5 });

  h.writeText(`◼ Incidence financière de l'avenant :`, { bold: true, after: 2 });
  h.writeText("L'avenant a une incidence financière sur le montant du marché public :", { indentLeft: 5, after: 3 });

  const incOui = data.incidenceFinanciere === 'oui';
  const incNon = data.incidenceFinanciere === 'non';
  h.writeCheckLine(incNon, 'Non', { indentLeft: 12, after: 2 });
  h.writeCheckLine(incOui, 'Oui', { indentLeft: 12, after: 3 });

  if (incOui) {
    h.writeText('Montant de l\'avenant :', { bold: true, indentLeft: 16, after: 2 });
    h.writeText(`Taux de la TVA : ${data.montantAvenantTVA !== undefined && data.montantAvenantTVA !== '' ? data.montantAvenantTVA : dots(10)} %`, { indentLeft: 20, after: 1 });
    h.writeText(`Montant HT : ${formatMontant(data.montantAvenantHT)} €`, { indentLeft: 20, after: 1 });
    h.writeText(`Montant TTC : ${formatMontant(data.montantAvenantTTC)} €`, { indentLeft: 20, after: 1 });
    h.writeText(`% d'écart introduit par l'avenant : ${data.ecartPourcent !== undefined && data.ecartPourcent !== '' ? data.ecartPourcent : dots(10)} %`, { indentLeft: 20, after: 4 });

    h.writeText('Nouveau montant du marché public :', { bold: true, indentLeft: 16, after: 2 });
    h.writeText(`Taux de la TVA : ${data.nouveauMontantTVA !== undefined && data.nouveauMontantTVA !== '' ? data.nouveauMontantTVA : dots(10)} %`, { indentLeft: 20, after: 1 });
    h.writeText(`Montant HT : ${formatMontant(data.nouveauMontantHT)} €`, { indentLeft: 20, after: 1 });
    h.writeText(`Montant TTC : ${formatMontant(data.nouveauMontantTTC)} €`, { indentLeft: 20, after: 3 });
  }
  h.addY(5);

  // ── Section E — Signature du titulaire du marché public ──
  h.drawSectionTitle('E', 'Signature du titulaire du marché public');
  h.addY(2);

  // Table with 3 columns and 3 empty rows
  const tableX = mL;
  const tableW = cW;
  const col1W = tableW * 0.40;
  const col2W = tableW * 0.30;
  const col3W = tableW * 0.30;
  const headerH = 8;
  const rowH = 14;
  const headerTexts = ['Nom, prénom et qualité du signataire (*)', 'Lieu et date de signature', 'Signature'];
  const colWidths = [col1W, col2W, col3W];

  // Draw header row with background
  pdf.setFillColor(...h.BG_COLOR);
  pdf.rect(tableX, h.getY(), tableW, headerH, 'F');
  pdf.setDrawColor(...h.BLACK); pdf.setLineWidth(0.3);
  pdf.rect(tableX, h.getY(), tableW, headerH);

  // Header cell borders and text
  let colX = tableX;
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.setTextColor(...h.BLACK);
  headerTexts.forEach((txt, i) => {
    if (i > 0) pdf.line(colX, h.getY(), colX, h.getY() + headerH);
    pdf.text(txt, colX + 2, h.getY() + 5);
    colX += colWidths[i];
  });
  h.addY(headerH);

  // 3 data rows (alternating white / light blue)
  for (let row = 0; row < 3; row++) {
    h.checkPage(rowH + 4);
    if (row % 2 === 1) {
      pdf.setFillColor(230, 245, 252);
      pdf.rect(tableX, h.getY(), tableW, rowH, 'F');
    }
    pdf.setDrawColor(...h.BLACK); pdf.setLineWidth(0.3);
    pdf.rect(tableX, h.getY(), tableW, rowH);
    colX = tableX;
    for (let c = 0; c < 3; c++) {
      if (c > 0) pdf.line(colX, h.getY(), colX, h.getY() + rowH);
      colX += colWidths[c];
    }
    h.addY(rowH);
  }

  // Note below the table
  h.addY(2);
  pdf.setFont('helvetica', 'italic'); pdf.setFontSize(7); pdf.setTextColor(...h.BLACK);
  pdf.text("(*) Le signataire doit avoir le pouvoir d'engager la personne qu'il représente.", mL, h.getY());
  h.addY(8);

  // ── Section F — Signature du pouvoir adjudicateur ou de l'entité adjudicatrice ──
  h.drawSectionTitle('F', "Signature du pouvoir adjudicateur ou de l'entité adjudicatrice");
  h.addY(2);

  h.writeText("Pour l'État et ses établissements :", { bold: true, after: 2 });
  h.writeText("(Visa ou avis de l'autorité chargée du contrôle financier.)", { italics: true, after: 6 });
  h.addY(12);
  h.writeText(`A : ${dots(25)}, le ${dots(20)}`, { after: 3 });
  h.writeText('Signature', { bold: true, after: 2 });
  h.writeText("(représentant du pouvoir adjudicateur ou de l'entité adjudicatrice)", { italics: true, size: h.FS, after: 4 });
  h.addY(8);

  // ── Section G — Notification de l'avenant au titulaire du marché public ──
  h.drawSectionTitle('G', "Notification de l'avenant au titulaire du marché public");
  h.addY(2);

  const boxPadding = 3;
  const sectionFontSize = 8;
  const lineHeight = 4;

  // Sub-section 1: En cas de remise contre récépissé
  {
    h.checkPage(50);
    const startBoxY = h.getY();
    const boxContent = [
      { t: 'En cas de remise contre récépissé :', bold: true },
      { t: '' },
      { t: "Reçue à titre de notification, la présente copie de l'avenant.", bold: false },
      { t: '' },
      { t: `A ${dots(25)}, le ${dots(20)}`, bold: false },
      { t: '' },
      { t: 'Signature du titulaire,', bold: false },
      { t: '' },
      { t: '' },
    ];
    pdf.setDrawColor(...h.BLACK); pdf.setLineWidth(0.3);
    const boxH = boxContent.length * lineHeight + boxPadding * 2;
    pdf.rect(mL, startBoxY, cW, boxH);
    let textY = startBoxY + boxPadding + lineHeight;
    boxContent.forEach((line) => {
      pdf.setFont('helvetica', line.bold ? 'bold' : 'normal');
      pdf.setFontSize(sectionFontSize);
      pdf.setTextColor(...h.BLACK);
      if (line.t) pdf.text(line.t, mL + boxPadding, textY);
      textY += lineHeight;
    });
    h.setY(startBoxY + boxH + 3);
  }

  // Sub-section 2: En cas d'envoi en lettre recommandé avec accusé de réception
  {
    h.checkPage(30);
    const startBoxY = h.getY();
    const boxContent = [
      { t: 'En cas d\'envoi en lettre recommandé avec accusé de réception :', bold: true },
      { t: '' },
      { t: "(Coller ici l'avis de réception postal.)", italics: true },
      { t: '' },
      { t: '' },
      { t: '' },
    ];
    const boxH = boxContent.length * lineHeight + boxPadding * 2;
    pdf.setDrawColor(...h.BLACK); pdf.setLineWidth(0.3);
    pdf.rect(mL, startBoxY, cW, boxH);
    let textY = startBoxY + boxPadding + lineHeight;
    boxContent.forEach((line) => {
      pdf.setFont('helvetica', line.italics ? 'italic' : line.bold ? 'bold' : 'normal');
      pdf.setFontSize(sectionFontSize);
      pdf.setTextColor(...h.BLACK);
      if (line.t) pdf.text(line.t, mL + boxPadding, textY);
      textY += lineHeight;
    });
    h.setY(startBoxY + boxH + 3);
  }

  // Sub-section 3: En cas de notification par voie électronique
  {
    h.checkPage(30);
    const startBoxY = h.getY();
    const boxContent = [
      { t: 'En cas de notification par voie électronique :', bold: true },
      { t: '' },
      { t: "(Indiquer la date et l'heure de la première consultation de la notification par le titulaire.)", italics: true },
      { t: '' },
      { t: '' },
    ];
    const boxH = boxContent.length * lineHeight + boxPadding * 2;
    pdf.setDrawColor(...h.BLACK); pdf.setLineWidth(0.3);
    pdf.rect(mL, startBoxY, cW, boxH);
    let textY = startBoxY + boxPadding + lineHeight;
    boxContent.forEach((line) => {
      pdf.setFont('helvetica', line.italics ? 'italic' : line.bold ? 'bold' : 'normal');
      pdf.setFontSize(sectionFontSize);
      pdf.setTextColor(...h.BLACK);
      if (line.t) pdf.text(line.t, mL + boxPadding, textY);
      textY += lineHeight;
    });
    h.setY(startBoxY + boxH + 3);
  }

  // Date de mise à jour
  h.checkPage(10);
  h.addY(5);
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8);
  pdf.text("Date de mise à jour : 01/04/2019.", mL, h.getY());

  const name = (fiche.nom || 'avenant').replace(/\s+/g, '_');
  const date = new Date().toISOString().slice(0, 10);
  pdf.save(`EXE10_Avenant${data.numeroAvenant || ''}_${name}_${date}.pdf`);
  return 'pdf';
};

// ─── EXPORT DOCX ────────────────────────────────────────────────────────────
export const exportExe10Docx = async (fiche, rawData) => {
  const data = { ...rawData };

  const MARIANNE_B64 = await loadMarianneImage();
  const { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, VerticalAlign, ImageRun } = await import('docx');

  const FONT = 'Arial', SN = 20, SS = 18, ST = 22, SL = 28;

  const BN = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const BS = { style: BorderStyle.SINGLE, size: 1, color: '000000' };
  const SG = { type: ShadingType.SOLID, color: 'B0E0F2' };

  const text = (c, o = {}) => new TextRun({ text: c, font: FONT, size: o.size || SN, bold: o.bold || false, italics: o.italics || false, ...o });
  const para = (ch, o = {}) => new Paragraph({ children: Array.isArray(ch) ? ch : [ch], spacing: { after: o.after ?? 120 }, alignment: o.alignment || AlignmentType.LEFT, indent: o.indent, ...o });
  const emptyLine = (a = 60) => para([text('')], { after: a });

  const sectionTitle = (letter, title) => new Table({
    rows: [new TableRow({ children: [new TableCell({ children: [para([text(`${letter} - ${title}`, { bold: true, size: ST })], { after: 0 })], shading: SG, borders: { top: BN, bottom: BN, left: BN, right: BN }, verticalAlign: VerticalAlign.CENTER, width: { size: 100, type: WidthType.PERCENTAGE } })] })],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });

  const chkLine = (condition, label, opts = {}) =>
    para([text(`${condition ? CHK : UNCHK}  ${label}`, { size: opts.size || SN })], { after: opts.after ?? 80, indent: { left: opts.indent ?? 400 } });

  const A = fiche.sectionA || {}, B = fiche.sectionB || {}, D = fiche.sectionD || {};
  const children = [];

  // Traitement de l'image Marianne pour le DOCX
  let marianneRun = null;
  if (MARIANNE_B64 && MARIANNE_B64.length > 10) {
    try {
      const base64Data = MARIANNE_B64.split(',')[1];
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      marianneRun = new ImageRun({ data: bytes, transformation: { width: 140, height: 80 } });
    } catch { /* skip */ }
  }

  // Header complet
  const marianneParagraph = marianneRun ? new Paragraph({ children: [marianneRun], alignment: AlignmentType.CENTER, spacing: { after: 100 } }) : emptyLine(0);

  // Le grand rectangle BLEU SANS BORDURE pour le titre principal
  const titleBoxTable = new Table({
    rows: [new TableRow({ children: [
      new TableCell({
        children: [
          para([text('MARCHÉS PUBLICS', { bold: true, size: ST })], { alignment: AlignmentType.CENTER, after: 40 }),
          para([text(`AVENANT N° ${data.numeroAvenant || dots(5)}`, { bold: true })], { alignment: AlignmentType.CENTER, after: 0 }),
        ],
        borders: { top: BN, bottom: BN, left: BN, right: BN }, padding: { top: 100, bottom: 100, left: 100, right: 100 },
        width: { size: 80, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER,
      }),
      new TableCell({
        children: [para([text('EXE10', { bold: true, size: SL })], { alignment: AlignmentType.RIGHT, after: 0 })],
        borders: { top: BN, bottom: BN, left: BN, right: BN }, padding: { top: 100, bottom: 100, left: 100, right: 100 },
        width: { size: 20, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER,
      }),
    ] })],
    width: { size: 100, type: WidthType.PERCENTAGE },
    shading: { fill: 'E0F3F8', type: ShadingType.SOLID },
  });

  children.push(marianneParagraph);
  children.push(para([text("MINISTÈRE DE L'ÉCONOMIE ET DES FINANCES", { bold: true })], { alignment: AlignmentType.CENTER, after: 40 }));
  children.push(para([text('Direction des Affaires Juridiques', { size: SS })], { alignment: AlignmentType.CENTER, after: 120 }));
  children.push(titleBoxTable);
  children.push(emptyLine(80));

  // ── Section A ──
  children.push(sectionTitle('A', "Identification du pouvoir adjudicateur ou de l'entité adjudicatrice"));
  [A.designation, A.adresse, [A.codePostal, A.ville].filter(Boolean).join(' ')].filter(Boolean).forEach(l => children.push(para([text(l)], { after: 40 })));
  children.push(emptyLine(200));

  // ── Section B ──
  children.push(sectionTitle('B', 'Identification du titulaire du marché public'));
  const cotraitantsB = Array.isArray(B.cotraitants) ? B.cotraitants.filter(c => c?.nomCommercial || c?.denominationSociale) : [];

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

  if (cotraitantsB.length === 0) {
    getEntParas(B.mandataire, null).forEach(p => children.push(p));
  } else {
    const allEntsDocx = [
      { ent: B.mandataire, label: 'Mandataire' },
      ...cotraitantsB.map((cot, i) => ({ ent: cot, label: `Co-traitant ${i + 1}` })),
    ];
    const colPct = Math.floor(100 / allEntsDocx.length);
    children.push(new Table({
      rows: [new TableRow({
        children: allEntsDocx.map(({ ent, label }) => new TableCell({
          children: getEntParas(ent, label),
          borders: { top: BN, bottom: BN, left: BN, right: BN },
          width: { size: colPct, type: WidthType.PERCENTAGE },
        })),
      })],
      width: { size: 100, type: WidthType.PERCENTAGE },
    }));
  }
  children.push(emptyLine(200));

  // ── Section C ──
  children.push(sectionTitle('C', 'Objet du marché public'));
  children.push(para([text(`◼ Objet du marché public : ${D.objet || dots(50)}`)], { after: 80 }));
  children.push(para([text(`◼ Date de la notification du marché public : ${formatDate(data.dateNotificationMarche || D.dateNotification)}`)], { after: 80 }));
  children.push(para([text(`◼ Durée d'exécution du marché public : ${D.dureeExecution || dots(10)} ${D.uniteDuree || 'mois'}`)], { after: 80 }));
  children.push(para([text(`◼ Montant initial du marché public :`, { bold: true })], { after: 40 }));
  children.push(para([text(`Taux de la TVA : ${data.montantInitialTVA !== undefined && data.montantInitialTVA !== '' ? data.montantInitialTVA : dots(10)} %`)], { after: 40, indent: { left: 400 } }));
  children.push(para([text(`Montant HT : ${formatMontant(data.montantInitialHT)} €`)], { after: 40, indent: { left: 400 } }));
  children.push(para([text(`Montant TTC : ${formatMontant(data.montantInitialTTC)} €`)], { after: 80, indent: { left: 400 } }));
  children.push(emptyLine(120));

  // ── Section D ──
  children.push(sectionTitle('D', "Objet de l'avenant"));
  children.push(para([text(`◼ Modifications introduites par le présent avenant :`, { bold: true })], { after: 40 }));
  children.push(para([text(data.modifications || dots(60))], { after: 120, indent: { left: 200 } }));

  children.push(para([text(`◼ Incidence financière de l'avenant :`, { bold: true })], { after: 40 }));
  children.push(para([text("L'avenant a une incidence financière sur le montant du marché public :")], { after: 60, indent: { left: 200 } }));

  const incOui = data.incidenceFinanciere === 'oui';
  const incNon = data.incidenceFinanciere === 'non';
  children.push(chkLine(incNon, 'Non', { indent: 400 }));
  children.push(chkLine(incOui, 'Oui', { indent: 400 }));

  if (incOui) {
    children.push(para([text("Montant de l'avenant :", { bold: true })], { after: 40, indent: { left: 600 } }));
    children.push(para([text(`Taux de la TVA : ${data.montantAvenantTVA !== undefined && data.montantAvenantTVA !== '' ? data.montantAvenantTVA : dots(10)} %`)], { after: 40, indent: { left: 800 } }));
    children.push(para([text(`Montant HT : ${formatMontant(data.montantAvenantHT)} €`)], { after: 40, indent: { left: 800 } }));
    children.push(para([text(`Montant TTC : ${formatMontant(data.montantAvenantTTC)} €`)], { after: 40, indent: { left: 800 } }));
    children.push(para([text(`% d'écart introduit par l'avenant : ${data.ecartPourcent !== undefined && data.ecartPourcent !== '' ? data.ecartPourcent : dots(10)} %`)], { after: 80, indent: { left: 800 } }));

    children.push(para([text('Nouveau montant du marché public :', { bold: true })], { after: 40, indent: { left: 600 } }));
    children.push(para([text(`Taux de la TVA : ${data.nouveauMontantTVA !== undefined && data.nouveauMontantTVA !== '' ? data.nouveauMontantTVA : dots(10)} %`)], { after: 40, indent: { left: 800 } }));
    children.push(para([text(`Montant HT : ${formatMontant(data.nouveauMontantHT)} €`)], { after: 40, indent: { left: 800 } }));
    children.push(para([text(`Montant TTC : ${formatMontant(data.nouveauMontantTTC)} €`)], { after: 80, indent: { left: 800 } }));
  }
  children.push(emptyLine(120));

  // ── Section E — Signature du titulaire du marché public ──
  children.push(sectionTitle('E', 'Signature du titulaire du marché public'));
  children.push(emptyLine(60));

  // Table with 3 columns, header + 3 empty rows
  const sigHeaders = ['Nom, prénom et qualité du signataire (*)', 'Lieu et date de signature', 'Signature'];
  const sigColPcts = [40, 30, 30];
  const sigRows = [];

  // Header row
  sigRows.push(new TableRow({
    children: sigHeaders.map((hdr, i) => new TableCell({
      children: [para([text(hdr, { bold: true, size: 16 })], { after: 0 })],
      shading: SG,
      borders: { top: BS, bottom: BS, left: BS, right: BS },
      width: { size: sigColPcts[i], type: WidthType.PERCENTAGE },
      verticalAlign: VerticalAlign.CENTER,
    })),
  }));

  // 3 empty data rows (alternating shading)
  for (let row = 0; row < 3; row++) {
    const rowShading = row % 2 === 1 ? { type: ShadingType.SOLID, color: 'E6F5FC' } : undefined;
    sigRows.push(new TableRow({
      children: sigHeaders.map((_, i) => new TableCell({
        children: [para([text('')], { after: 0 }), emptyLine(200)],
        shading: rowShading,
        borders: { top: BS, bottom: BS, left: BS, right: BS },
        width: { size: sigColPcts[i], type: WidthType.PERCENTAGE },
      })),
    }));
  }

  children.push(new Table({ rows: sigRows, width: { size: 100, type: WidthType.PERCENTAGE } }));
  children.push(para([text("(*) Le signataire doit avoir le pouvoir d'engager la personne qu'il représente.", { italics: true, size: 14 })], { after: 120 }));
  children.push(emptyLine(120));

  // ── Section F — Signature du pouvoir adjudicateur ou de l'entité adjudicatrice ──
  children.push(sectionTitle('F', "Signature du pouvoir adjudicateur ou de l'entité adjudicatrice"));
  children.push(emptyLine(60));
  children.push(para([text("Pour l'État et ses établissements :", { bold: true })], { after: 40 }));
  children.push(para([text("(Visa ou avis de l'autorité chargée du contrôle financier.)", { italics: true })], { after: 120 }));
  children.push(emptyLine(300));
  children.push(para([text(`A : ${dots(25)}, le ${dots(20)}`)], { after: 80 }));
  children.push(para([text('Signature', { bold: true })], { after: 40 }));
  children.push(para([text("(représentant du pouvoir adjudicateur ou de l'entité adjudicatrice)", { italics: true, size: SS })], { after: 120 }));
  children.push(emptyLine(200));

  // ── Section G — Notification de l'avenant au titulaire du marché public ──
  children.push(sectionTitle('G', "Notification de l'avenant au titulaire du marché public"));
  children.push(emptyLine(60));

  // Sub-section 1: En cas de remise contre récépissé
  children.push(new Table({
    rows: [new TableRow({ children: [new TableCell({
      children: [
        para([text('En cas de remise contre récépissé :', { bold: true, size: SS })], { after: 80 }),
        para([text("Reçue à titre de notification, la présente copie de l'avenant.", { size: SS })], { after: 80 }),
        emptyLine(60),
        para([text(`A ${dots(25)}, le ${dots(20)}`, { size: SS })], { after: 60 }),
        para([text('Signature du titulaire,', { size: SS })], { after: 80 }),
        emptyLine(120),
      ],
      borders: { top: BS, bottom: BS, left: BS, right: BS },
      width: { size: 100, type: WidthType.PERCENTAGE },
    })] })],
    width: { size: 100, type: WidthType.PERCENTAGE },
  }));
  children.push(emptyLine(60));

  // Sub-section 2: En cas d'envoi en lettre recommandé avec accusé de réception
  children.push(new Table({
    rows: [new TableRow({ children: [new TableCell({
      children: [
        para([text("En cas d'envoi en lettre recommandé avec accusé de réception :", { bold: true, size: SS })], { after: 80 }),
        para([text("(Coller ici l'avis de réception postal.)", { italics: true, size: SS })], { after: 80 }),
        emptyLine(300),
      ],
      borders: { top: BS, bottom: BS, left: BS, right: BS },
      width: { size: 100, type: WidthType.PERCENTAGE },
    })] })],
    width: { size: 100, type: WidthType.PERCENTAGE },
  }));
  children.push(emptyLine(60));

  // Sub-section 3: En cas de notification par voie électronique
  children.push(new Table({
    rows: [new TableRow({ children: [new TableCell({
      children: [
        para([text('En cas de notification par voie électronique :', { bold: true, size: SS })], { after: 80 }),
        para([text("(Indiquer la date et l'heure de la première consultation de la notification par le titulaire.)", { italics: true, size: SS })], { after: 80 }),
        emptyLine(200),
      ],
      borders: { top: BS, bottom: BS, left: BS, right: BS },
      width: { size: 100, type: WidthType.PERCENTAGE },
    })] })],
    width: { size: 100, type: WidthType.PERCENTAGE },
  }));
  children.push(emptyLine(120));

  // Pied de page
  children.push(para([text('Date de mise à jour : 01/04/2019.', { size: 16 })], { after: 0 }));

  const doc = new Document({ sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 1080, right: 1080 } } }, children }] });
  const blob = await Packer.toBlob(doc);
  const name = (fiche.nom || 'avenant').replace(/\s+/g, '_');
  const date = new Date().toISOString().slice(0, 10);
  saveAs(blob, `EXE10_Avenant${data.numeroAvenant || ''}_${name}_${date}.docx`);
};
