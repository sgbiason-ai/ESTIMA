// src/utils/docAdmin/generateExe8.js
// Génération EXE8 — Procès-verbal de levée des réserves
// Conforme au formulaire officiel (DAJ - mise à jour 01/04/2019)
import { saveAs } from 'file-saver';
import { loadMoeSignatureWithDimensions } from './moeDefaults.js';

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

const CHK = '\u2612';
const UNCHK = '\u2610';

// ─── Helpers PDF communs ──────────────────────────────────────────────────
const createPdfHelpers = (pdf, pageW, pageH, mL, mR, cW) => {
  const BG_COLOR = [176, 224, 242], BLACK = [0, 0, 0]; // Bleu cyan #B0E0F2
  const FN = 10, FS = 9, FT = 11, LH = 5;
  let y = 18;

  const getY = () => y;
  const setY = (v) => { y = v; };
  const addY = (v) => { y += v; };

  const checkPage = (n = 20) => { if (y + n > pageH - 20) { pdf.addPage(); y = 18; } };

  // Titres de section (A, B, C...) : fond bleu SANS bordure
  const drawSectionTitle = (letter, title) => {
    const fullText = `${letter} - ${title}`;
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(FT);
    const lines = pdf.splitTextToSize(fullText, cW - 6);
    const boxH = Math.max(8, lines.length * 5 + 3);
    checkPage(boxH + 6);
    pdf.setFillColor(...BG_COLOR);
    pdf.rect(mL, y, cW, boxH, 'F'); // 'F' = Fill uniquement, sans bordure
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
export const exportExe8Pdf = async (fiche, rawData) => {
  const data = { ...rawData };

  const MARIANNE_B64 = await loadMarianneImage();
  const { default: jsPDF } = await import('jspdf');

  const A = fiche.sectionA || {}, B = fiche.sectionB || {}, C = fiche.sectionC || {}, D = fiche.sectionD || {};
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
  pdf.text("MINIST\u00c8RE DE L'\u00c9CONOMIE ET DES FINANCES", pageW / 2, currentY, { align: 'center' });
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
  pdf.text('MARCH\u00c9S PUBLICS', pageW / 2, boxTitleY + 8, { align: 'center' });

  pdf.setFontSize(11);
  pdf.text('R\u00c9CEPTION DES TRAVAUX', pageW / 2, boxTitleY + 15, { align: 'center' });

  pdf.setFontSize(10); pdf.setFont('helvetica', 'normal');
  pdf.text('PROC\u00c8S-VERBAL DE LEV\u00c9E DES R\u00c9SERVES', pageW / 2, boxTitleY + 21, { align: 'center' });

  // EXE8 aligné à droite, dans le même rectangle bleu
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(22);
  pdf.text('EXE8', pageW - mR - 5, boxTitleY + 17, { align: 'right' });

  h.setY(boxTitleY + boxTitleH + 10);

  // ── Sections A-D ──
  h.drawSectionTitle('A', "Identification du pouvoir adjudicateur ou de l'entit\u00e9 adjudicatrice");
  [A.designation, A.adresse, [A.codePostal, A.ville].filter(Boolean).join('  ')].filter(Boolean).forEach(l => h.writeText(l, { after: 0 }));
  h.addY(8);

  h.drawSectionTitle('B', 'Identification du titulaire du march\u00e9 public');
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

  h.drawSectionTitle('C', "Identification du ma\u00eetre d'\u0153uvre");
  h.writeEntreprise(C); h.addY(8);

  h.drawSectionTitle('D', "Objet du march\u00e9 public");
  if (D.objet) h.writeText(D.objet, { after: 2 }); h.addY(5);

  // ── Section E — Objet du procès-verbal de levée des réserves ──
  h.drawSectionTitle('E', "Objet du proc\u00e8s-verbal de lev\u00e9e des r\u00e9serves");

  h.writeText("La lev\u00e9e des r\u00e9serves porte sur :", { after: 3 });

  h.writeCheckLine(data.porteeReception === 'globale', "la r\u00e9ception de l'ouvrage comportant les prestations suivantes :", { after: 1 });
  if (data.porteeReception === 'globale' && D.objet) h.writeText(D.objet, { indentLeft: 18, size: h.FS, after: 3 });

  h.writeCheckLine(data.porteeReception === 'partielle', "la r\u00e9ception partielle de l'ouvrage relative aux prestations d\u00e9sign\u00e9es ci-dessous :", { after: 1 });
  if (data.porteeReception === 'partielle' && data.designationPartielle) h.writeText(data.designationPartielle, { indentLeft: 18, size: h.FS, after: 3 });
  h.addY(4);

  // ── Section F — Procès-verbal de levée des réserves ──
  h.checkPage(60);
  h.drawSectionTitle('F', "Proc\u00e8s-verbal de lev\u00e9e des r\u00e9serves");

  const moeName = C.nomCommercial || C.denominationSociale || dots(40);
  h.writeText(`Je, soussign\u00e9, ${moeName}, ma\u00eetre d'\u0153uvre,`, { after: 2 });

  // Présences
  h.writeCheckLine(data.exe8_presencePA === 'present', "en pr\u00e9sence du repr\u00e9sentant du pouvoir adjudicateur ou de l'entit\u00e9 adjudicatrice ;", { after: 2 });
  h.writeCheckLine(data.exe8_presencePA === 'absent_avise', "en l'absence du repr\u00e9sentant du pouvoir adjudicateur ou de l'entit\u00e9 adjudicatrice, d\u00fbment avis\u00e9 ;", { after: 2 });
  h.writeCheckLine(data.exe8_presenceTitulaire === 'present', "en pr\u00e9sence du titulaire du march\u00e9 public ;", { after: 2 });
  const dateConv = data.exe8_presenceTitulaire === 'absent_convoque' ? formatDate(data.exe8_dateConvocationTitulaire) : dots(15);
  h.writeCheckLine(data.exe8_presenceTitulaire === 'absent_convoque', `en l'absence du titulaire du march\u00e9 public d\u00fbment convoqu\u00e9, par courrier en date du ${dateConv}.`, { after: 4 });

  h.writeText("apr\u00e8s avoir proc\u00e9d\u00e9 aux examens et v\u00e9rifications n\u00e9cessaires, constate que :", { after: 2 });

  // 1. Épreuves
  h.writeText("1. les \u00e9preuves, pr\u00e9vues au march\u00e9 public :", { bold: true, after: 3 });
  h.writeCheckLine(data.exe8_epreuves === 'non_effectuees', "n'ont pas \u00e9t\u00e9 effectu\u00e9es ;", { after: 2 });
  h.writeCheckLine(data.exe8_epreuves === 'effectuees', `ont \u00e9t\u00e9 effectu\u00e9es, \u00e0 l'exception de celles indiqu\u00e9es \u00e0 l'annexe n\u00b0 ${data.exe8_epreuvesExceptions || dots(10)} ci-jointe ;`, { after: 1 });
  if (data.exe8_epreuves === 'effectuees') {
    h.writeCheckLine(data.exe8_epreuvesConcluantes === 'concluantes', "et sont concluantes ;", { indentLeft: 24, after: 2 });
    h.writeCheckLine(data.exe8_epreuvesConcluantes === 'exceptions', `et sont concluantes, \u00e0 l'exception de celles indiqu\u00e9es \u00e0 l'annexe n\u00b0 ${data.exe8_epreuvesConcluantesExceptions || dots(10)} ci-jointe ;`, { indentLeft: 24, after: 2 });
  }
  h.addY(2);

  // 2. Travaux et prestations ayant fait l'objet de réserves
  h.writeText("2. les travaux et prestations, ayant fait l'objet de r\u00e9serves :", { bold: true, after: 3 });
  h.writeCheckLine(data.exe8_travauxExecutes === 'oui', "ont \u00e9t\u00e9 ex\u00e9cut\u00e9s ;", { after: 2 });
  h.writeCheckLine(data.exe8_travauxExecutes === 'exceptions', `ont \u00e9t\u00e9 ex\u00e9cut\u00e9s, \u00e0 l'exception de ceux indiqu\u00e9s \u00e0 l'annexe n\u00b0 ${data.exe8_travauxExceptions || dots(10)} ci-jointe ;`, { after: 2 });
  h.addY(2);

  // 3. Ouvrages
  h.writeText("3. les ouvrages :", { bold: true, after: 3 });
  h.writeCheckLine(data.exe8_ouvragesConformes === 'oui', "sont conformes aux sp\u00e9cifications du march\u00e9 public, les imperfections et malfa\u00e7ons constat\u00e9es ayant \u00e9t\u00e9 corrig\u00e9es ;", { after: 2 });
  h.writeCheckLine(data.exe8_ouvragesConformes === 'exceptions', `sont conformes aux sp\u00e9cifications du march\u00e9 public, \u00e0 l'exception des imperfections ou malfa\u00e7ons indiqu\u00e9es \u00e0 l'annexe n\u00b0 ${data.exe8_ouvragesExceptions || dots(10)} ci-jointe, qui n'ont pas \u00e9t\u00e9 corrig\u00e9es ;`, { after: 2 });
  h.addY(2);

  // 4. Conditions de pose des équipements
  h.writeText("4. les conditions de pose des \u00e9quipements :", { bold: true, after: 3 });
  h.writeCheckLine(data.exe8_poseEquipements === 'conforme', "sont conformes aux sp\u00e9cifications des fournisseurs ;", { after: 2 });
  h.writeCheckLine(data.exe8_poseEquipements === 'non_conforme', "ne sont pas conformes aux sp\u00e9cifications des fournisseurs.", { after: 2 });
  h.addY(2);

  // 5. Installations de chantier
  h.writeText("5. les installations de chantier :", { bold: true, after: 3 });
  h.writeCheckLine(data.exe8_repliInstallations === 'oui', "ont \u00e9t\u00e9 repli\u00e9es ;", { after: 2 });
  h.writeCheckLine(data.exe8_repliInstallations === 'non', "n'ont pas \u00e9t\u00e9 repli\u00e9es ;", { after: 2 });
  h.addY(2);

  // 6. Terrains et lieux
  h.writeText("6. les terrains et les lieux :", { bold: true, after: 3 });
  h.writeCheckLine(data.exe8_remiseEnEtatTerrains === 'oui', "ont \u00e9t\u00e9 remis en \u00e9tat ;", { after: 2 });
  h.writeCheckLine(data.exe8_remiseEnEtatTerrains === 'non', "n'ont pas \u00e9t\u00e9 remis en \u00e9tat.", { after: 2 });
  h.addY(6);

  // ── Signatures (deux colonnes côte à côte) ──
  h.checkPage(50);
  const colMid = mL + cW / 2;

  // Charger la signature MOE
  const moeSig = await loadMoeSignatureWithDimensions();

  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(h.FN);
  pdf.text(`Dress\u00e9 le ${formatDate(data.exe8_dateSignatureMoe)}`, mL, h.getY());
  pdf.text(`Accept\u00e9 le ${formatDate(data.exe8_dateSignatureTitulaire)}`, colMid + 10, h.getY());
  h.addY(5);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Signature', mL, h.getY());
  pdf.text('Signature', colMid + 10, h.getY());
  h.addY(4);

  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(h.FS);
  pdf.text("(ma\u00eetre d'\u0153uvre)", mL, h.getY());
  pdf.text('(titulaire)', colMid + 10, h.getY());
  h.addY(4);

  // Image signature MOE
  if (moeSig) {
    const sigMaxW = 45, sigMaxH = 25;
    const sigRatio = Math.min(sigMaxW / moeSig.width, sigMaxH / moeSig.height, 1);
    const sigW = moeSig.width * sigRatio;
    const sigH = moeSig.height * sigRatio;
    h.checkPage(sigH + 8);
    try { pdf.addImage(moeSig.dataUrl, 'JPEG', mL, h.getY(), sigW, sigH); } catch { /* skip */ }
    h.addY(sigH + 2);
  } else {
    h.addY(10);
  }

  h.addY(6);

  // ── Refus de signature du titulaire ──
  if (data.exe8_refusSignatureTitulaire) {
    h.writeCheckLine(true, "J'atteste que le titulaire du march\u00e9 public a refus\u00e9 de signer le pr\u00e9sent proc\u00e8s-verbal.", { after: 4 });
    h.writeText(`Dress\u00e9 le ${formatDate(data.exe8_dateSignatureMoe)}`, { after: 2 });
    h.writeText('Signature', { bold: true, after: 1 });
    h.writeText("(ma\u00eetre d'\u0153uvre)", { size: h.FS, after: 1 });
    // Signature MOE pour la section refus
    if (moeSig) {
      const sigMaxW2 = 45, sigMaxH2 = 25;
      const sigRatio2 = Math.min(sigMaxW2 / moeSig.width, sigMaxH2 / moeSig.height, 1);
      const sigW2 = moeSig.width * sigRatio2;
      const sigH2 = moeSig.height * sigRatio2;
      h.checkPage(sigH2 + 8);
      try { pdf.addImage(moeSig.dataUrl, 'JPEG', mL, h.getY(), sigW2, sigH2); } catch { /* skip */ }
      h.addY(sigH2 + 2);
    }
  } else {
    h.writeCheckLine(false, "J'atteste que le titulaire du march\u00e9 public a refus\u00e9 de signer le pr\u00e9sent proc\u00e8s-verbal.", { after: 4 });
    h.writeText(`Dress\u00e9 le ${dots(20)}`, { after: 2 });
    h.writeText('Signature', { bold: true, after: 1 });
    h.writeText("(ma\u00eetre d'\u0153uvre)", { size: h.FS, after: 1 });
  }

  // Date de mise à jour
  h.checkPage(10);
  h.addY(5);
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8);
  pdf.text("Date de mise \u00e0 jour : 01/04/2019.", mL, h.getY());

  pdf.save(`EXE8_${(fiche.nom || 'levee-reserves').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
  return 'pdf';
};

// ─── EXPORT DOCX ────────────────────────────────────────────────────────────
export const exportExe8Docx = async (fiche, rawData) => {
  const data = { ...rawData };

  const MARIANNE_B64 = await loadMarianneImage();
  const { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, VerticalAlign, ImageRun } = await import('docx');

  const FONT = 'Arial', SN = 20, SS = 18, ST = 22, SL = 28;

  const BN = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const SG = { type: ShadingType.SOLID, color: 'B0E0F2' }; // Bleu cyan #B0E0F2

  const text = (c, o = {}) => new TextRun({ text: c, font: FONT, size: o.size || SN, bold: o.bold || false, italics: o.italics || false, ...o });
  const para = (ch, o = {}) => new Paragraph({ children: Array.isArray(ch) ? ch : [ch], spacing: { after: o.after ?? 120, before: o.before ?? 0 }, alignment: o.alignment || AlignmentType.LEFT, indent: o.indent, ...o });
  const emptyLine = (a = 60) => para([text('')], { after: a });

  // Titres de section (A, B, C...) : fond bleu SANS bordure
  const sectionTitle = (letter, title) => new Table({
    rows: [new TableRow({ children: [new TableCell({ children: [para([text(`${letter} - ${title}`, { bold: true, size: ST })], { after: 0 })], shading: SG, borders: { top: BN, bottom: BN, left: BN, right: BN }, verticalAlign: VerticalAlign.CENTER, width: { size: 100, type: WidthType.PERCENTAGE } })] })],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
  const chkLine = (condition, label, opts = {}) =>
    para([text(`${condition ? CHK : UNCHK}  ${label}`, { size: opts.size || SN })], { after: opts.after ?? 80, indent: { left: opts.indent ?? 400 } });

  const A = fiche.sectionA || {}, B = fiche.sectionB || {}, C = fiche.sectionC || {}, D = fiche.sectionD || {};
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
          para([text('MARCH\u00c9S PUBLICS', { bold: true, size: ST })], { alignment: AlignmentType.CENTER, after: 40 }),
          para([text('R\u00c9CEPTION DES TRAVAUX', { bold: true })], { alignment: AlignmentType.CENTER, after: 60 }),
          para([text('PROC\u00c8S-VERBAL DE LEV\u00c9E DES R\u00c9SERVES', { size: SS })], { alignment: AlignmentType.CENTER, after: 0 }),
        ],
        borders: { top: BN, bottom: BN, left: BN, right: BN }, padding: { top: 100, bottom: 100, left: 100, right: 100 },
        width: { size: 80, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER,
      }),
      new TableCell({
        children: [para([text('EXE8', { bold: true, size: SL })], { alignment: AlignmentType.RIGHT, after: 0 })],
        borders: { top: BN, bottom: BN, left: BN, right: BN }, padding: { top: 100, bottom: 100, left: 100, right: 100 },
        width: { size: 20, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER,
      }),
    ] })],
    width: { size: 100, type: WidthType.PERCENTAGE },
    shading: { fill: 'E0F3F8', type: ShadingType.SOLID }
  });

  children.push(marianneParagraph);
  children.push(para([text("MINIST\u00c8RE DE L'\u00c9CONOMIE ET DES FINANCES", { bold: true })], { alignment: AlignmentType.CENTER, after: 40 }));
  children.push(para([text('Direction des Affaires Juridiques', { size: SS })], { alignment: AlignmentType.CENTER, after: 120 }));
  children.push(titleBoxTable);
  children.push(emptyLine(80));

  // ── Sections A-D ──
  children.push(sectionTitle('A', "Identification du pouvoir adjudicateur ou de l'entit\u00e9 adjudicatrice"));
  [A.designation, A.adresse, [A.codePostal, A.ville].filter(Boolean).join(' ')].filter(Boolean).forEach(l => children.push(para([text(l)], { after: 40 })));
  children.push(emptyLine(200));

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
    const allEntsDocx = [
      { ent: B.mandataire, label: 'Mandataire' },
      ...cotraitantsB_docx.map((cot, i) => ({ ent: cot, label: `Co-traitant ${i + 1}` })),
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

  children.push(sectionTitle('C', "Identification du ma\u00eetre d'\u0153uvre"));
  const cName = C.nomCommercial || C.denominationSociale || dots(60);
  const cAddr = [C.adresse, [C.codePostal, C.ville].filter(Boolean).join(' ')].filter(Boolean);
  children.push(para([text(cName)], { after: 40 }));
  cAddr.forEach(l => children.push(para([text(l)], { after: 40 })));
  children.push(emptyLine(200));

  children.push(sectionTitle('D', "Objet du march\u00e9 public"));
  if (D.objet) children.push(para([text(D.objet)], { after: 80 }));
  children.push(emptyLine(120));

  // ── Section E — Objet du procès-verbal de levée des réserves ──
  children.push(sectionTitle('E', "Objet du proc\u00e8s-verbal de lev\u00e9e des r\u00e9serves"));
  children.push(para([text("La lev\u00e9e des r\u00e9serves porte sur :")], { after: 80 }));

  children.push(chkLine(data.porteeReception === 'globale', "la r\u00e9ception de l'ouvrage comportant les prestations suivantes :"));
  if (data.porteeReception === 'globale' && D.objet) children.push(para([text(D.objet, { size: SS })], { after: 80, indent: { left: 800 } }));
  children.push(chkLine(data.porteeReception === 'partielle', "la r\u00e9ception partielle de l'ouvrage relative aux prestations d\u00e9sign\u00e9es ci-dessous :"));
  if (data.porteeReception === 'partielle' && data.designationPartielle) children.push(para([text(data.designationPartielle, { size: SS })], { after: 80, indent: { left: 800 } }));
  children.push(emptyLine(120));

  // ── Section F — Procès-verbal de levée des réserves ──
  children.push(sectionTitle('F', "Proc\u00e8s-verbal de lev\u00e9e des r\u00e9serves"));

  const moeName = C.nomCommercial || C.denominationSociale || dots(40);
  children.push(para([text(`Je, soussign\u00e9, ${moeName}, ma\u00eetre d'\u0153uvre,`)], { after: 60 }));

  // Présences
  children.push(chkLine(data.exe8_presencePA === 'present', "en pr\u00e9sence du repr\u00e9sentant du pouvoir adjudicateur ou de l'entit\u00e9 adjudicatrice ;"));
  children.push(chkLine(data.exe8_presencePA === 'absent_avise', "en l'absence du repr\u00e9sentant du pouvoir adjudicateur ou de l'entit\u00e9 adjudicatrice, d\u00fbment avis\u00e9 ;"));
  children.push(chkLine(data.exe8_presenceTitulaire === 'present', "en pr\u00e9sence du titulaire du march\u00e9 public ;"));
  const dateConvDocx = data.exe8_presenceTitulaire === 'absent_convoque' ? formatDate(data.exe8_dateConvocationTitulaire) : dots(15);
  children.push(chkLine(data.exe8_presenceTitulaire === 'absent_convoque', `en l'absence du titulaire du march\u00e9 public d\u00fbment convoqu\u00e9, par courrier en date du ${dateConvDocx}.`));

  children.push(para([text("apr\u00e8s avoir proc\u00e9d\u00e9 aux examens et v\u00e9rifications n\u00e9cessaires, constate que :")], { after: 60, before: 80 }));

  // 1. Épreuves
  children.push(para([text("1. les \u00e9preuves, pr\u00e9vues au march\u00e9 public :", { bold: true })], { after: 60 }));
  children.push(chkLine(data.exe8_epreuves === 'non_effectuees', "n'ont pas \u00e9t\u00e9 effectu\u00e9es ;"));
  children.push(chkLine(data.exe8_epreuves === 'effectuees', `ont \u00e9t\u00e9 effectu\u00e9es, \u00e0 l'exception de celles indiqu\u00e9es \u00e0 l'annexe n\u00b0 ${data.exe8_epreuvesExceptions || dots(15)} ci-jointe ;`));
  if (data.exe8_epreuves === 'effectuees') {
    children.push(chkLine(data.exe8_epreuvesConcluantes === 'concluantes', "et sont concluantes ;", { indent: 800 }));
    children.push(chkLine(data.exe8_epreuvesConcluantes === 'exceptions', `et sont concluantes, \u00e0 l'exception de celles indiqu\u00e9es \u00e0 l'annexe n\u00b0 ${data.exe8_epreuvesConcluantesExceptions || dots(15)} ci-jointe ;`, { indent: 800 }));
  }

  // 2. Travaux
  children.push(para([text("2. les travaux et prestations, ayant fait l'objet de r\u00e9serves :", { bold: true })], { after: 60 }));
  children.push(chkLine(data.exe8_travauxExecutes === 'oui', "ont \u00e9t\u00e9 ex\u00e9cut\u00e9s ;"));
  children.push(chkLine(data.exe8_travauxExecutes === 'exceptions', `ont \u00e9t\u00e9 ex\u00e9cut\u00e9s, \u00e0 l'exception de ceux indiqu\u00e9s \u00e0 l'annexe n\u00b0 ${data.exe8_travauxExceptions || dots(15)} ci-jointe ;`));

  // 3. Ouvrages
  children.push(para([text("3. les ouvrages :", { bold: true })], { after: 60 }));
  children.push(chkLine(data.exe8_ouvragesConformes === 'oui', "sont conformes aux sp\u00e9cifications du march\u00e9 public, les imperfections et malfa\u00e7ons constat\u00e9es ayant \u00e9t\u00e9 corrig\u00e9es ;"));
  children.push(chkLine(data.exe8_ouvragesConformes === 'exceptions', `sont conformes aux sp\u00e9cifications du march\u00e9 public, \u00e0 l'exception des imperfections ou malfa\u00e7ons indiqu\u00e9es \u00e0 l'annexe n\u00b0 ${data.exe8_ouvragesExceptions || dots(15)} ci-jointe, qui n'ont pas \u00e9t\u00e9 corrig\u00e9es ;`));

  // 4. Pose
  children.push(para([text("4. les conditions de pose des \u00e9quipements :", { bold: true })], { after: 60 }));
  children.push(chkLine(data.exe8_poseEquipements === 'conforme', "sont conformes aux sp\u00e9cifications des fournisseurs ;"));
  children.push(chkLine(data.exe8_poseEquipements === 'non_conforme', "ne sont pas conformes aux sp\u00e9cifications des fournisseurs."));

  // 5. Installations
  children.push(para([text("5. les installations de chantier :", { bold: true })], { after: 60 }));
  children.push(chkLine(data.exe8_repliInstallations === 'oui', "ont \u00e9t\u00e9 repli\u00e9es ;"));
  children.push(chkLine(data.exe8_repliInstallations === 'non', "n'ont pas \u00e9t\u00e9 repli\u00e9es ;"));

  // 6. Terrains
  children.push(para([text("6. les terrains et les lieux :", { bold: true })], { after: 60 }));
  children.push(chkLine(data.exe8_remiseEnEtatTerrains === 'oui', "ont \u00e9t\u00e9 remis en \u00e9tat ;"));
  children.push(chkLine(data.exe8_remiseEnEtatTerrains === 'non', "n'ont pas \u00e9t\u00e9 remis en \u00e9tat."));

  children.push(emptyLine(200));

  // ── Signatures (deux colonnes côte à côte) ──
  // Charger la signature MOE pour DOCX
  const moeSigDocx = await loadMoeSignatureWithDimensions();
  let moeSigRun = null;
  if (moeSigDocx) {
    try {
      const base64Data = moeSigDocx.dataUrl.split(',')[1];
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      const sigMaxW = 150, sigMaxH = 80;
      const sigRatio = Math.min(sigMaxW / moeSigDocx.width, sigMaxH / moeSigDocx.height, 1);
      moeSigRun = new ImageRun({ data: bytes, transformation: { width: Math.round(moeSigDocx.width * sigRatio), height: Math.round(moeSigDocx.height * sigRatio) } });
    } catch { /* skip */ }
  }

  const moeSigChildren = [
    para([text(`Dress\u00e9 le ${formatDate(data.exe8_dateSignatureMoe)}`)], { after: 0 }),
    para([text('Signature', { bold: true })], { after: 40 }),
    para([text("(ma\u00eetre d'\u0153uvre)", { size: SS })], { after: 40 }),
  ];
  if (moeSigRun) moeSigChildren.push(new Paragraph({ children: [moeSigRun], spacing: { after: 0 } }));

  children.push(new Table({
    rows: [
      new TableRow({ children: [
        new TableCell({
          children: moeSigChildren,
          borders: { top: BN, bottom: BN, left: BN, right: BN },
          width: { size: 50, type: WidthType.PERCENTAGE },
        }),
        new TableCell({
          children: [
            para([text(`Accept\u00e9 le ${formatDate(data.exe8_dateSignatureTitulaire)}`)], { after: 0 }),
            para([text('Signature', { bold: true })], { after: 40 }),
            para([text('(titulaire)', { size: SS })], { after: 40 }),
          ],
          borders: { top: BN, bottom: BN, left: BN, right: BN },
          width: { size: 50, type: WidthType.PERCENTAGE },
        }),
      ] }),
    ],
    width: { size: 100, type: WidthType.PERCENTAGE },
  }));

  children.push(emptyLine(200));

  // ── Refus de signature du titulaire ──
  children.push(chkLine(data.exe8_refusSignatureTitulaire, "J'atteste que le titulaire du march\u00e9 public a refus\u00e9 de signer le pr\u00e9sent proc\u00e8s-verbal."));
  children.push(emptyLine(60));
  children.push(para([text(`Dress\u00e9 le ${data.exe8_refusSignatureTitulaire ? formatDate(data.exe8_dateSignatureMoe) : dots(20)}`)], { after: 40 }));
  children.push(para([text('Signature', { bold: true })], { after: 0 }));
  children.push(para([text("(ma\u00eetre d'\u0153uvre)", { size: SS })], { after: 0 }));

  // Signature MOE pour section refus si applicable
  if (data.exe8_refusSignatureTitulaire && moeSigRun) {
    // Re-créer le ImageRun car il ne peut pas être réutilisé
    try {
      const base64Data2 = moeSigDocx.dataUrl.split(',')[1];
      const binaryString2 = atob(base64Data2);
      const bytes2 = new Uint8Array(binaryString2.length);
      for (let i = 0; i < binaryString2.length; i++) bytes2[i] = binaryString2.charCodeAt(i);
      const sigMaxW2 = 150, sigMaxH2 = 80;
      const sigRatio2 = Math.min(sigMaxW2 / moeSigDocx.width, sigMaxH2 / moeSigDocx.height, 1);
      const moeSigRun2 = new ImageRun({ data: bytes2, transformation: { width: Math.round(moeSigDocx.width * sigRatio2), height: Math.round(moeSigDocx.height * sigRatio2) } });
      children.push(new Paragraph({ children: [moeSigRun2], spacing: { after: 100 } }));
    } catch { /* skip */ }
  }

  children.push(emptyLine(200));
  // Pied de page
  children.push(para([text('Date de mise \u00e0 jour : 01/04/2019.', { size: 16 })], { after: 0 }));

  const doc = new Document({ sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 1080, right: 1080 } } }, children }] });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `EXE8_${(fiche.nom || 'levee-reserves').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.docx`);
};
