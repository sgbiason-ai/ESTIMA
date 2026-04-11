// src/utils/docAdmin/generateExe4.js
// Génération EXE4 — Procès-verbal des opérations préalables à la réception
// Conforme au formulaire officiel (DAJ - mise à jour 01/04/2019)
import { saveAs } from 'file-saver';
import { generateAnnexeReservesPdf, generateAnnexeReservesDocx } from './annexeReserves.js';
import { loadMoeSignatureWithDimensions, loadMoeSignature } from './moeDefaults.js';
import { formatDateLocale } from '../dateHelpers';

const dots = (n = 40) => '.'.repeat(n);
const formatDate = (s) => formatDateLocale(s, { fallback: dots(20) });

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

const CHK = '☒';
const UNCHK = '☐';

// ─── EXPORT PDF ─────────────────────────────────────────────────────────────
export const exportExe4Pdf = async (fiche, rawData) => {
  // Auto-dérivation des dates (fallbacks logiques)
  const data = { ...rawData };
  if (!data.dateSignatureMoe && data.dateOPR) data.dateSignatureMoe = data.dateOPR;
  if (!data.dateSignatureTitulaire && data.dateOPR) data.dateSignatureTitulaire = data.dateOPR;

  const { default: jsPDF } = await import('jspdf');
  const MARIANNE_B64 = await loadMarianneImage();

  const A = fiche.sectionA || {};
  const B = fiche.sectionB || {};
  const C = fiche.sectionC || {};
  const D = fiche.sectionD || {};

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const mL = 20, mR = 20;
  const cW = pageW - mL - mR;
  let y = 18;

  const BG_COLOR = [176, 224, 242]; // Bleu cyan #B0E0F2
  const BLACK = [0, 0, 0];
  const FN = 10, FS = 9, FT = 11, LH = 5;

  const checkPage = (needed = 20) => { if (y + needed > pageH - 20) { pdf.addPage(); y = 18; } };

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
    const size = opts.size || FN;
    pdf.setFont('helvetica', opts.bold ? 'bold' : opts.italics ? 'italic' : 'normal');
    pdf.setFontSize(size); pdf.setTextColor(...BLACK);
    const maxW = cW - (opts.indentLeft || 0);
    const lines = pdf.splitTextToSize(content, maxW);
    lines.forEach((line) => {
      checkPage(LH + 2);
      const xPos = opts.align === 'right' ? pageW - mR : mL + (opts.indentLeft || 0);
      pdf.text(line, xPos, y, { align: opts.align || 'left' });
      y += LH;
    });
    y += (opts.after || 1);
  };

  // Dessine une case à cocher graphique (rectangle + croix si cochée)
  const drawCheckbox = (x, yPos, checked) => {
    const size = 3.5;
    pdf.setDrawColor(...BLACK);
    pdf.setLineWidth(0.3);
    pdf.rect(x, yPos - size + 0.5, size, size);
    if (checked) {
      pdf.setLineWidth(0.5);
      pdf.line(x + 0.5, yPos - size + 1, x + size - 0.5, yPos);
      pdf.line(x + size - 0.5, yPos - size + 1, x + 0.5, yPos);
    }
  };

  // Écrit une ligne avec case à cocher graphique
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
      pdf.text(line, i === 0 ? textX : textX, y);
      y += LH;
    });
    y += (opts.after || 2);
  };

  const writeEntreprise = (ent) => {
    if (!ent) { writeText(dots(60)); return; }
    [ent.nomCommercial, ent.denominationSociale ? `(${ent.denominationSociale})` : '',
      ent.adresse, [ent.codePostal, ent.ville].filter(Boolean).join('  '),
      ent.email ? `Email : ${ent.email}` : '', ent.telephone ? `Tel. : ${ent.telephone}` : '',
    ].filter(Boolean).forEach(p => writeText(p, { after: 0 }));
    y += 2;
  };

  // ── En-tête (Design Fidèle DAJ avec logo et encadrement bleu SANS bordure) ──
  if (MARIANNE_B64 && MARIANNE_B64.length > 10) {
    const logoW = 35, logoH = 20; // Ajuste ces valeurs selon les proportions de ton image
    const logoX = (pageW - logoW) / 2;
    try { pdf.addImage(MARIANNE_B64, 'JPEG', logoX, y, logoW, logoH); } catch { /* skip */ }
    y += logoH + 5;
  }
  
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(FN);
  pdf.text("MINISTÈRE DE L'ÉCONOMIE ET DES FINANCES", pageW / 2, y, { align: 'center' });
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(FS);
  pdf.text('Direction des Affaires Juridiques', pageW / 2, y + 5, { align: 'center' });
  
  y += 12;

  const boxTitleY = y;
  const boxTitleH = 26;
  pdf.setFillColor(...BG_COLOR);
  pdf.rect(mL, boxTitleY, cW, boxTitleH, 'F');
  
  pdf.setTextColor(...BLACK);
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(14);
  pdf.text('MARCHÉS PUBLICS', pageW / 2, boxTitleY + 8, { align: 'center' });
  pdf.setFontSize(11);
  pdf.text('RÉCEPTION DES TRAVAUX', pageW / 2, boxTitleY + 15, { align: 'center' });
  pdf.setFontSize(10); pdf.setFont('helvetica', 'normal');
  pdf.text("procès-verbal des opérations préalables à la réception", pageW / 2, boxTitleY + 21, { align: 'center' });
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(22);
  pdf.text('EXE4', pageW - mR - 5, boxTitleY + 17, { align: 'right' });

  y = boxTitleY + boxTitleH + 10;

  // Section A
  drawSectionTitle('A', "Identification du pouvoir adjudicateur ou de l'entité adjudicatrice");
  [A.designation, A.adresse, [A.codePostal, A.ville].filter(Boolean).join('  ')].filter(Boolean).forEach(l => writeText(l, { after: 0 }));
  y += 8;

  // Section B
  drawSectionTitle('B', 'Identification du titulaire du marché public');
  const cotraitantsB_pdf = Array.isArray(B.cotraitants) ? B.cotraitants.filter(c => c?.nomCommercial || c?.denominationSociale) : [];
  const allEntsB_pdf = [
    { ent: B.mandataire, label: cotraitantsB_pdf.length > 0 ? 'Mandataire' : null },
    ...cotraitantsB_pdf.map((cot, i) => ({ ent: cot, label: `Co-traitant ${i + 1}` })),
  ];

  if (allEntsB_pdf.length <= 1) {
    writeEntreprise(B.mandataire);
  } else {
    const nB = allEntsB_pdf.length;
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

    const renderedColsB = allEntsB_pdf.map(({ ent, label }) => {
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

  // Section C
  drawSectionTitle('C', "Identification du maître d'œuvre");
  writeEntreprise(C);
  y += 8;

  // Section D
  drawSectionTitle('D', 'Objet du marché public');
  if (D.objet) writeText(D.objet, { after: 2 });
  y += 5;

  // Section E — Objet des OPR
  drawSectionTitle('E', 'Objet des opérations préalables à la réception des ouvrages');
  writeText(`Date d'achèvement des travaux proposée par le titulaire du marché public : ${formatDate(data.dateAchevementProposee)}`, { after: 4 });
  writeText("Les opérations préalables à la réception des ouvrages portent sur :", { after: 2 });

  writeCheckLine(data.porteeReception === 'globale', "la réception de l'ouvrage comportant les prestations suivantes :", { after: 1 });
  if (data.porteeReception === 'globale' && D.objet) writeText(D.objet, { indentLeft: 18, size: FS, after: 3 });

  writeCheckLine(data.porteeReception === 'partielle', "la réception partielle de l'ouvrage relative aux prestations désignées ci-dessous :", { after: 1 });
  if (data.porteeReception === 'partielle' && data.designationPartielle) writeText(data.designationPartielle, { indentLeft: 18, size: FS, after: 3 });
  y += 4;

  // Section F — PV des OPR
  checkPage(60);
  drawSectionTitle('F', "Procès-verbal des opérations préalables à la réception des ouvrages");

  const moeName = C.nomCommercial || C.denominationSociale || dots(40);
  writeText(`Je soussigné, ${moeName}, maître d'œuvre,`, { after: 2 });

  // Présences
  writeCheckLine(data.presencePA === 'present', "en présence du représentant du pouvoir adjudicateur ou de l'entité adjudicatrice ;", { after: 2 });
  writeCheckLine(data.presencePA === 'absent_avise', "en l'absence du représentant du pouvoir adjudicateur ou de l'entité adjudicatrice, dûment avisé par mes soins ;", { after: 2 });
  writeCheckLine(data.presenceTitulaire === 'present', "en présence du titulaire du marché public ;", { after: 2 });
  const dateConv = data.presenceTitulaire === 'absent_convoque' ? formatDate(data.dateConvocationTitulaire) : dots(15);
  writeCheckLine(data.presenceTitulaire === 'absent_convoque', `en l'absence du titulaire du marché public dûment convoqué, par courrier en date du ${dateConv}.`, { after: 4 });

  writeText("après avoir procédé aux examens et vérifications nécessaires, constate que :", { after: 2 });

  // 1. Épreuves
  const epEff = data.epreuves === 'effectuees' || data.epreuves === 'concluantes' || data.epreuves === 'exceptions';
  writeText("1. les épreuves, prévues au marché public :", { bold: true, after: 3 });
  writeCheckLine(data.epreuves === 'non_effectuees', "n'ont pas été effectuées ;", { after: 2 });
  writeCheckLine(epEff, `ont été effectuées${data.epreuves === 'exceptions' ? `, à l'exception de celles indiquées à l'annexe n° ${data.epreuvesExceptions || dots(10)} ci-jointe` : ''} ;`, { after: 1 });
  if (epEff) {
    writeCheckLine(data.epreuves === 'concluantes', "et sont concluantes ;", { indentLeft: 24, after: 2 });
    writeCheckLine(data.epreuves === 'exceptions', `et sont concluantes, à l'exception de celles indiquées à l'annexe n° ${data.epreuvesExceptions || dots(10)} ci-jointe ;`, { indentLeft: 24, after: 2 });
  }
  y += 2;

  // 2. Travaux
  writeText("2. les travaux et prestations, prévus au marché public :", { bold: true, after: 3 });
  writeCheckLine(data.travauxExputes === 'oui', "ont été exécutés ;", { after: 2 });
  writeCheckLine(data.travauxExputes === 'exceptions', `ont été exécutés, à l'exception de ceux indiqués à l'annexe n° ${data.travauxExceptions || dots(10)} ci-jointe ;`, { after: 2 });
  y += 2;

  // 3. Ouvrages
  writeText("3. les ouvrages :", { bold: true, after: 3 });
  writeCheckLine(data.ouvragesConformes === 'oui', "sont conformes aux spécifications du marché public ;", { after: 2 });
  writeCheckLine(data.ouvragesConformes === 'exceptions', `sont conformes aux spécifications du marché public, à l'exception des imperfections ou malfaçons indiquées à l'annexe n° ${data.ouvragesExceptions || dots(10)} ci-jointe ;`, { after: 2 });
  y += 2;

  // 4. Pose équipements
  writeText("4. les conditions de pose des équipements :", { bold: true, after: 3 });
  writeCheckLine(data.poseEquipements === 'conforme', "sont conformes aux spécifications des fournisseurs ;", { after: 2 });
  writeCheckLine(data.poseEquipements === 'non_conforme', "ne sont pas conformes aux spécifications des fournisseurs.", { after: 2 });
  y += 2;

  // 5. Installations
  writeText("5. les installations de chantier :", { bold: true, after: 3 });
  writeCheckLine(data.repliInstallations === 'oui', "ont été repliées ;", { after: 2 });
  writeCheckLine(data.repliInstallations === 'non', "n'ont pas été repliées ;", { after: 2 });
  y += 2;

  // 6. Terrains
  writeText("6. les terrains et les lieux :", { bold: true, after: 3 });
  writeCheckLine(data.remiseEnEtatTerrains === 'oui', "ont été remis en état ;", { after: 2 });
  writeCheckLine(data.remiseEnEtatTerrains === 'non', "n'ont pas été remis en état.", { after: 2 });
  y += 6;

  // Signatures (deux colonnes côte à côte)
  checkPage(50);
  const colMid = mL + cW / 2;

  // Charger la signature MOE
  const moeSig = await loadMoeSignatureWithDimensions();

  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(FN);
  pdf.text(`Dressé le ${formatDate(data.dateSignatureMoe)}`, mL, y);
  pdf.text(`Accepté le ${formatDate(data.dateSignatureTitulaire)}`, colMid + 10, y);
  y += 5;
  pdf.setFont('helvetica', 'bold');
  pdf.text('Signature', mL, y);
  pdf.text('Signature', colMid + 10, y);
  y += 4;

  // Image signature MOE
  if (moeSig) {
    const sigMaxW = 45, sigMaxH = 25;
    const sigRatio = Math.min(sigMaxW / moeSig.width, sigMaxH / moeSig.height, 1);
    const sigW = moeSig.width * sigRatio;
    const sigH = moeSig.height * sigRatio;
    try { pdf.addImage(moeSig.dataUrl, 'JPEG', mL, y, sigW, sigH); } catch { /* skip */ }
    y += sigH + 2;
  } else {
    y += 10;
  }

  // Attestation refus
  if (data.refusSignatureTitulaire) {
    y += 4;
    writeCheckLine(true, "J'atteste que le titulaire du marché public a refusé de signer le présent procès-verbal.", { after: 4 });
    writeText(`Dressé le ${formatDate(data.dateSignatureMoe)}`, { after: 2 });
    writeText('Signature', { bold: true, after: 1 });
  } else {
    writeCheckLine(false, "J'atteste que le titulaire du marché public a refusé de signer le présent procès-verbal.", { after: 4 });
    writeText(`Dressé le ${dots(20)}`, { after: 2 });
    writeText('Signature', { bold: true, after: 1 });
  }

  // Annexe des réserves (si présentes)
  await generateAnnexeReservesPdf(pdf, data, 'EXE4', fiche);

  const filename = `EXE4_${(fiche.nom || 'pv-opr').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
  pdf.save(filename);
  return 'pdf';
};

// ─── EXPORT DOCX ────────────────────────────────────────────────────────────
export const exportExe4Docx = async (fiche, rawData) => {
  // Auto-dérivation des dates (fallbacks logiques)
  const data = { ...rawData };
  if (!data.dateSignatureMoe && data.dateOPR) data.dateSignatureMoe = data.dateOPR;
  if (!data.dateSignatureTitulaire && data.dateOPR) data.dateSignatureTitulaire = data.dateOPR;

  const MARIANNE_B64 = await loadMarianneImage();
  const {
    Document, Packer, Paragraph, TextRun, AlignmentType,
    Table, TableRow, TableCell, WidthType, BorderStyle,
    ShadingType, VerticalAlign, ImageRun,
  } = await import('docx');

  const FONT = 'Arial';
  const SN = 20, SS = 18, ST = 22, SL = 28;
  const BN = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const SG = { type: ShadingType.SOLID, color: 'B0E0F2' }; // Bleu cyan #B0E0F2

  const text = (c, o = {}) => new TextRun({ text: c, font: FONT, size: o.size || SN, bold: o.bold || false, italics: o.italics || false, ...o });
  const para = (ch, o = {}) => new Paragraph({ children: Array.isArray(ch) ? ch : [ch], spacing: { after: o.after ?? 120, before: o.before ?? 0 }, alignment: o.alignment || AlignmentType.LEFT, indent: o.indent, ...o });
  const emptyLine = (a = 60) => para([text('')], { after: a });

  const sectionTitle = (letter, title) => new Table({
    rows: [new TableRow({ children: [new TableCell({
      children: [para([text(`${letter} - ${title}`, { bold: true, size: ST })], { after: 0 })],
      shading: SG, borders: { top: BN, bottom: BN, left: BN, right: BN },
      verticalAlign: VerticalAlign.CENTER, width: { size: 100, type: WidthType.PERCENTAGE },
    })] })],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });

  const chkLine = (condition, label, opts = {}) =>
    para([text(`${condition ? CHK : UNCHK}  ${label}`, { size: opts.size || SN })], { after: opts.after ?? 80, indent: { left: opts.indent ?? 400 } });

  const children = [];
  const A = fiche.sectionA || {}, B = fiche.sectionB || {}, C = fiche.sectionC || {}, D = fiche.sectionD || {};

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

  const marianneParagraph = marianneRun ? new Paragraph({ children: [marianneRun], alignment: AlignmentType.CENTER, spacing: { after: 100 } }) : emptyLine(0);

  const titleBoxTable = new Table({
    rows: [new TableRow({ children: [
      new TableCell({
        children: [
          para([text('MARCHÉS PUBLICS', { bold: true, size: ST })], { alignment: AlignmentType.CENTER, after: 40 }),
          para([text('RÉCEPTION DES TRAVAUX', { bold: true })], { alignment: AlignmentType.CENTER, after: 60 }),
          para([text("procès-verbal des opérations préalables à la réception", { size: SS })], { alignment: AlignmentType.CENTER, after: 0 }),
        ],
        borders: { top: BN, bottom: BN, left: BN, right: BN }, padding: { top: 100, bottom: 100, left: 100, right: 100 },
        width: { size: 80, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER,
      }),
      new TableCell({
        children: [para([text('EXE4', { bold: true, size: SL })], { alignment: AlignmentType.RIGHT, after: 0 })],
        borders: { top: BN, bottom: BN, left: BN, right: BN }, padding: { top: 100, bottom: 100, left: 100, right: 100 },
        width: { size: 20, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER,
      }),
    ] })],
    width: { size: 100, type: WidthType.PERCENTAGE },
    shading: { fill: 'E0F3F8', type: ShadingType.SOLID }
  });

  children.push(marianneParagraph);
  children.push(para([text("MINISTÈRE DE L'ÉCONOMIE ET DES FINANCES", { bold: true })], { alignment: AlignmentType.CENTER, after: 40 }));
  children.push(para([text('Direction des Affaires Juridiques', { size: SS })], { alignment: AlignmentType.CENTER, after: 120 }));
  children.push(titleBoxTable);
  children.push(emptyLine(80));

  // A
  children.push(sectionTitle('A', "Identification du pouvoir adjudicateur ou de l'entité adjudicatrice"));
  [A.designation, A.adresse, [A.codePostal, A.ville].filter(Boolean).join(' ')].filter(Boolean).forEach(l => children.push(para([text(l)], { after: 40 })));
  children.push(emptyLine(200));

  // B
  children.push(sectionTitle('B', 'Identification du titulaire du marché public'));
  const cotraitantsB_docx = Array.isArray(B.cotraitants) ? B.cotraitants.filter(c => c?.nomCommercial || c?.denominationSociale) : [];

  const getEntParasB = (ent, label) => {
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
    getEntParasB(B.mandataire, null).forEach(p => children.push(p));
  } else {
    const allEntsB_docx = [
      { ent: B.mandataire, label: 'Mandataire' },
      ...cotraitantsB_docx.map((cot, i) => ({ ent: cot, label: `Co-traitant ${i + 1}` })),
    ];
    const colPctB = Math.floor(100 / allEntsB_docx.length);
    children.push(new Table({
      rows: [new TableRow({
        children: allEntsB_docx.map(({ ent, label }) => new TableCell({
          children: getEntParasB(ent, label),
          borders: { top: BN, bottom: BN, left: BN, right: BN },
          width: { size: colPctB, type: WidthType.PERCENTAGE },
        })),
      })],
      width: { size: 100, type: WidthType.PERCENTAGE },
    }));
  }
  children.push(emptyLine(200));

  // C
  children.push(sectionTitle('C', "Identification du maître d'œuvre"));
  const cName = C.nomCommercial || C.denominationSociale || dots(60);
  const cAddr = [C.adresse, [C.codePostal, C.ville].filter(Boolean).join(' ')].filter(Boolean);
  children.push(para([text(cName)], { after: 40 }));
  cAddr.forEach(l => children.push(para([text(l)], { after: 40 })));
  children.push(emptyLine(200));

  // D
  children.push(sectionTitle('D', 'Objet du marché public'));
  if (D.objet) children.push(para([text(D.objet)], { after: 80 }));
  children.push(emptyLine(120));

  // E — Objet des OPR
  children.push(sectionTitle('E', 'Objet des opérations préalables à la réception des ouvrages'));
  children.push(para([text(`Date d'achèvement des travaux proposée par le titulaire du marché public : ${formatDate(data.dateAchevementProposee)}`)], { after: 120 }));
  children.push(para([text("Les opérations préalables à la réception des ouvrages portent sur :")], { after: 60 }));
  children.push(chkLine(data.porteeReception === 'globale', "la réception de l'ouvrage comportant les prestations suivantes :"));
  if (data.porteeReception === 'globale' && D.objet) children.push(para([text(D.objet, { size: SS })], { after: 80, indent: { left: 800 } }));
  children.push(chkLine(data.porteeReception === 'partielle', "la réception partielle de l'ouvrage relative aux prestations désignées ci-dessous :"));
  if (data.porteeReception === 'partielle' && data.designationPartielle) children.push(para([text(data.designationPartielle, { size: SS })], { after: 80, indent: { left: 800 } }));
  children.push(emptyLine(120));

  // F — PV des OPR
  children.push(sectionTitle('F', 'Procès-verbal des opérations préalables à la réception des ouvrages'));
  const moeName = C.nomCommercial || C.denominationSociale || dots(40);
  children.push(para([text(`Je soussigné, ${moeName}, maître d'œuvre,`)], { after: 60 }));

  // Présences
  children.push(chkLine(data.presencePA === 'present', "en présence du représentant du pouvoir adjudicateur ou de l'entité adjudicatrice ;"));
  children.push(chkLine(data.presencePA === 'absent_avise', "en l'absence du représentant du pouvoir adjudicateur ou de l'entité adjudicatrice, dûment avisé par mes soins ;"));
  children.push(chkLine(data.presenceTitulaire === 'present', "en présence du titulaire du marché public ;"));
  const dateConvDocx = data.presenceTitulaire === 'absent_convoque' ? formatDate(data.dateConvocationTitulaire) : dots(15);
  children.push(chkLine(data.presenceTitulaire === 'absent_convoque', `en l'absence du titulaire du marché public dûment convoqué, par courrier en date du ${dateConvDocx}.`));

  children.push(para([text("après avoir procédé aux examens et vérifications nécessaires, constate que :")], { after: 60, before: 80 }));

  // 1. Épreuves
  const epEff = data.epreuves === 'effectuees' || data.epreuves === 'concluantes' || data.epreuves === 'exceptions';
  children.push(para([text("1. les épreuves, prévues au marché public :", { bold: true })], { after: 60 }));
  children.push(chkLine(data.epreuves === 'non_effectuees', "n'ont pas été effectuées ;"));
  children.push(chkLine(epEff, `ont été effectuées${data.epreuves === 'exceptions' ? `, à l'exception de celles indiquées à l'annexe n° ${data.epreuvesExceptions || dots(15)} ci-jointe` : ''} ;`));
  if (epEff) {
    children.push(chkLine(data.epreuves === 'concluantes', "et sont concluantes ;", { indent: 800 }));
    children.push(chkLine(data.epreuves === 'exceptions', `et sont concluantes, à l'exception de celles indiquées à l'annexe n° ${data.epreuvesExceptions || dots(15)} ci-jointe ;`, { indent: 800 }));
  }

  // 2. Travaux
  children.push(para([text("2. les travaux et prestations, prévus au marché public :", { bold: true })], { after: 60 }));
  children.push(chkLine(data.travauxExputes === 'oui', "ont été exécutés ;"));
  children.push(chkLine(data.travauxExputes === 'exceptions', `ont été exécutés, à l'exception de ceux indiqués à l'annexe n° ${data.travauxExceptions || dots(15)} ci-jointe ;`));

  // 3. Ouvrages
  children.push(para([text("3. les ouvrages :", { bold: true })], { after: 60 }));
  children.push(chkLine(data.ouvragesConformes === 'oui', "sont conformes aux spécifications du marché public ;"));
  children.push(chkLine(data.ouvragesConformes === 'exceptions', `sont conformes aux spécifications du marché public, à l'exception des imperfections ou malfaçons indiquées à l'annexe n° ${data.ouvragesExceptions || dots(15)} ci-jointe ;`));

  // 4. Pose
  children.push(para([text("4. les conditions de pose des équipements :", { bold: true })], { after: 60 }));
  children.push(chkLine(data.poseEquipements === 'conforme', "sont conformes aux spécifications des fournisseurs ;"));
  children.push(chkLine(data.poseEquipements === 'non_conforme', "ne sont pas conformes aux spécifications des fournisseurs."));

  // 5. Installations
  children.push(para([text("5. les installations de chantier :", { bold: true })], { after: 60 }));
  children.push(chkLine(data.repliInstallations === 'oui', "ont été repliées ;"));
  children.push(chkLine(data.repliInstallations === 'non', "n'ont pas été repliées ;"));

  // 6. Terrains
  children.push(para([text("6. les terrains et les lieux :", { bold: true })], { after: 60 }));
  children.push(chkLine(data.remiseEnEtatTerrains === 'oui', "ont été remis en état ;"));
  children.push(chkLine(data.remiseEnEtatTerrains === 'non', "n'ont pas été remis en état."));

  children.push(emptyLine(200));

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

  // Signatures (deux colonnes)
  const moeSigChildren = [
    para([text(`Dressé le ${formatDate(data.dateSignatureMoe)}`)], { after: 0 }),
    para([text('Signature', { bold: true })], { after: 40 }),
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
            para([text(`Accepté le ${formatDate(data.dateSignatureTitulaire)}`)], { after: 0 }),
            para([text('Signature', { bold: true })], { after: 40 }),
          ],
          borders: { top: BN, bottom: BN, left: BN, right: BN },
          width: { size: 50, type: WidthType.PERCENTAGE },
        }),
      ] }),
    ],
    width: { size: 100, type: WidthType.PERCENTAGE },
  }));

  children.push(emptyLine(200));

  // Attestation refus
  children.push(chkLine(data.refusSignatureTitulaire, "J'atteste que le titulaire du marché public a refusé de signer le présent procès-verbal."));
  children.push(emptyLine(60));
  children.push(para([text(`Dressé le ${data.refusSignatureTitulaire ? formatDate(data.dateSignatureMoe) : dots(20)}`)], { after: 40 }));
  children.push(para([text('Signature', { bold: true })], { after: 0 }));

  children.push(emptyLine(200));

  // Annexe des réserves (si présentes)
  const annexeChildren = await generateAnnexeReservesDocx(data, 'EXE4', fiche);
  children.push(...annexeChildren);

  const doc = new Document({ sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 1080, right: 1080 } } }, children }] });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `EXE4_${(fiche.nom || 'pv-opr').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.docx`);
};
