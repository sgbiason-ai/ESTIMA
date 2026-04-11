// src/utils/docAdmin/generateExe5.js
// Génération EXE5 — Propositions du Maître d'Œuvre
// Conforme au formulaire officiel (DAJ - mise à jour 01/04/2019)
import { saveAs } from 'file-saver';
import { generateAnnexeReservesPdf, generateAnnexeReservesDocx } from './annexeReserves.js';
import { loadMoeSignatureWithDimensions } from './moeDefaults.js';
import { formatDateLocale } from '../dateHelpers';

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
const formatDate = (s) => formatDateLocale(s, { fallback: blankDate });

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
export const exportExe5Pdf = async (fiche, rawData) => {
  const data = { ...rawData };
  if (!data.dateSignatureMoe && data.dateOPR) data.dateSignatureMoe = data.dateOPR;
  if (!data.dateAchevementRetenue && data.dateAchevementProposee) data.dateAchevementRetenue = data.dateAchevementProposee;
  if (!data.lieuSignatureMoe) data.lieuSignatureMoe = 'BANNIERES';

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
    const logoW = 35, logoH = 20; // Ajuste ces valeurs selon les proportions de ton image
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
  const boxTitleW = cW; // Prend toute la largeur disponible
  const boxTitleX = mL;
  
  pdf.setFillColor(...h.BG_COLOR); // On utilise le bleu cyan
  pdf.rect(boxTitleX, boxTitleY, boxTitleW, boxTitleH, 'F'); // 'F' = Fill (remplissage uniquement, PAS de bordure)
  
  // 4. Textes à l'intérieur du rectangle bleu
  pdf.setTextColor(...h.BLACK);
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(14);
  pdf.text('MARCHÉS PUBLICS', pageW / 2, boxTitleY + 8, { align: 'center' });

  pdf.setFontSize(11);
  pdf.text('RÉCEPTION DES TRAVAUX', pageW / 2, boxTitleY + 15, { align: 'center' });

  pdf.setFontSize(10); pdf.setFont('helvetica', 'normal');
  pdf.text("PROPOSITIONS DU MAÎTRE D'ŒUVRE", pageW / 2, boxTitleY + 21, { align: 'center' });
  
  // EXE5 aligné à droite, dans le même rectangle bleu
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(22);
  pdf.text('EXE5', pageW - mR - 5, boxTitleY + 17, { align: 'right' });

  h.setY(boxTitleY + boxTitleH + 10);

  // A-D
  h.drawSectionTitle('A', "Identification du pouvoir adjudicateur ou de l'entité adjudicatrice");
  [A.designation, A.adresse, [A.codePostal, A.ville].filter(Boolean).join('  ')].filter(Boolean).forEach(l => h.writeText(l, { after: 0 }));
  h.addY(8);
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

    // Pré-calcul du rendu (wrapping inclus) pour mesurer la hauteur max
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
  h.drawSectionTitle('C', "Identification du maître d'œuvre");
  h.writeEntreprise(C); h.addY(8);
  h.drawSectionTitle('D', 'Objet du marché public');
  if (D.objet) h.writeText(D.objet, { after: 2 }); h.addY(5);

  // E — Propositions
  h.drawSectionTitle('E', "Propositions du maître d'œuvre relatives au procès-verbal des opérations préalables à la réception des ouvrages");

  h.writeText(`Au vu du procès-verbal des opérations préalables à la réception des ouvrages, en date du ${formatDate(data.dateOPR)} (date PV des OPR), je, soussigné, maître d'œuvre, propose :`, { after: 5 });

  const prononcer = data.propositionMoe === 'prononcer';

  // 1. Prononcer
  h.writeText(`1.  de prononcer la réception, en retenant, pour l'achèvement des travaux, la date du ${formatDate(data.dateAchevementRetenue)}`, { bold: true, indentLeft: 5, after: 3 });
  h.writeText("Cette réception serait prononcée :", { indentLeft: 12, after: 2 });

  // 1.1 Sans réserve
  h.writeCheckLine(prononcer && data.typeReception === 'sans_reserve', "sans réserve.", { indentLeft: 16, after: 4 });

  // 1.2 Sous réserve
  h.writeCheckLine(prononcer && data.typeReception === 'sous_reserve', "sous réserve :", { indentLeft: 16, after: 2 });

  const hasEpreuvesReserve = data.epreuves === 'exceptions';
  const hasTravauxReserve = data.travauxExputes === 'exceptions';
  h.writeCheckLine(hasEpreuvesReserve, `de l'exécution concluante des épreuves énumérées à l'annexe n° ${data.epreuvesExceptions || dots(12)} ci-jointe.`, { indentLeft: 22, after: 3 });
  h.writeCheckLine(hasTravauxReserve, `de l'exécution des travaux et prestations énumérés à l'annexe n° ${data.travauxExceptions || dots(12)} ci-jointe.`, { indentLeft: 22, after: 4 });

  // 1.3 Avec réserve
  h.writeCheckLine(prononcer && data.typeReception === 'avec_reserve', "avec réserve :", { indentLeft: 16, after: 2 });

  const hasOuvragesReserve = data.ouvragesConformes === 'exceptions';
  const reserves = (data.reserves || []).filter(r => r.designation);
  const premierDelai = reserves.length > 0 ? formatDate(reserves[0].delaiLevee) : blankDate;
  h.writeCheckLine(hasOuvragesReserve, `le titulaire doit remédier, avant le ${premierDelai}, aux imperfections et malfaçons indiquées à l'annexe n° ${data.ouvragesExceptions || dots(12)} ci-jointe.`, { indentLeft: 24, after: 2 });

  const hasRefaction = !!data.refactionMontant;
  h.writeCheckLine(hasRefaction, `Toutefois, il est proposé que cette dernière réserve soit levée, si le titulaire du marché public accepte une réfaction égale en prix de base à : ${data.refactionMontant || dots(20)}.`, { indentLeft: 30, size: h.FS, after: 4 });

  const hasRepli = data.repliInstallations === 'non';
  h.writeCheckLine(hasRepli, `les installations de chantier doivent être repliées et les terrains et les lieux doivent être remis en état, avant le ${formatDate(data.delaiRepliInstallations)}.`, { indentLeft: 24, after: 3 });

  const hasPose = data.poseEquipements === 'non_conforme';
  h.writeCheckLine(hasPose, `les conditions de pose des équipements doivent être mises en conformité avec les spécifications des fournisseurs, avant le ${formatDate(data.delaiMiseConformiteEquipements)}.`, { indentLeft: 24, after: 5 });

  // 2. Ne pas prononcer
  h.writeText(`2.  de ne pas prononcer la réception.`, { bold: data.propositionMoe === 'ne_pas_prononcer', indentLeft: 5, after: 6 });
  h.addY(5);

  // F — Signature MOE
  h.drawSectionTitle('F', "Signature du maître d'œuvre");
  h.addY(5);
  h.writeText(`A : ${data.lieuSignatureMoe || dots(25)}, le ${formatDate(data.dateSignatureMoe)}`, { align: 'right', after: 4 });
  h.writeText('Signature', { align: 'right', bold: true, after: 2 });

  // Image signature MOE
  const moeSig5 = await loadMoeSignatureWithDimensions();
  if (moeSig5) {
    const sigMaxW = 45, sigMaxH = 25;
    const sigRatio = Math.min(sigMaxW / moeSig5.width, sigMaxH / moeSig5.height, 1);
    const sigW = moeSig5.width * sigRatio;
    const sigH = moeSig5.height * sigRatio;
    h.checkPage(sigH + 8);
    try { pdf.addImage(moeSig5.dataUrl, 'JPEG', pageW - mR - sigW, h.getY(), sigW, sigH); } catch { /* skip */ }
    h.addY(sigH + 2);
  } else {
    h.addY(10);
  }

  // Date de mise à jour
  h.checkPage(10);
  h.addY(5);
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8);
  pdf.text("Date de mise à jour : 01/04/2019.", mL, h.getY());

  // Annexe des réserves
  await generateAnnexeReservesPdf(pdf, data, 'EXE5', fiche);

  pdf.save(`EXE5_${(fiche.nom || 'propositions-moe').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
  return 'pdf';
};

// ─── EXPORT DOCX ────────────────────────────────────────────────────────────
export const exportExe5Docx = async (fiche, rawData) => {
  const data = { ...rawData };
  if (!data.dateSignatureMoe && data.dateOPR) data.dateSignatureMoe = data.dateOPR;
  if (!data.dateAchevementRetenue && data.dateAchevementProposee) data.dateAchevementRetenue = data.dateAchevementProposee;
  if (!data.lieuSignatureMoe) data.lieuSignatureMoe = 'BANNIERES';

  const MARIANNE_B64 = await loadMarianneImage();
  const { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, VerticalAlign, ImageRun } = await import('docx');
  
  const FONT = 'Arial', SN = 20, SS = 18, ST = 22, SL = 28;

  const BN = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }; 
  const SG = { type: ShadingType.SOLID, color: 'B0E0F2' }; // Bleu cyan #B0E0F2
  
  const text = (c, o = {}) => new TextRun({ text: c, font: FONT, size: o.size || SN, bold: o.bold || false, italics: o.italics || false, ...o });
  const para = (ch, o = {}) => new Paragraph({ children: Array.isArray(ch) ? ch : [ch], spacing: { after: o.after ?? 120 }, alignment: o.alignment || AlignmentType.LEFT, indent: o.indent, ...o });
  const emptyLine = (a = 60) => para([text('')], { after: a });
  
  // Titres de section (A, B, C...) : fond bleu AVEC bordure
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
      marianneRun = new ImageRun({ data: bytes, transformation: { width: 140, height: 80 } }); // Ajuste la taille si besoin
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
          para([text('RÉCEPTION DES TRAVAUX', { bold: true })], { alignment: AlignmentType.CENTER, after: 60 }),
          para([text("PROPOSITIONS DU MAÎTRE D'ŒUVRE", { size: SS })], { alignment: AlignmentType.CENTER, after: 0 }),
        ],
        borders: { top: BN, bottom: BN, left: BN, right: BN }, padding: { top: 100, bottom: 100, left: 100, right: 100 },
        width: { size: 80, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER,
      }),
      new TableCell({
        children: [para([text('EXE5', { bold: true, size: SL })], { alignment: AlignmentType.RIGHT, after: 0 })],
        borders: { top: BN, bottom: BN, left: BN, right: BN }, padding: { top: 100, bottom: 100, left: 100, right: 100 },
        width: { size: 20, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER,
      }),
    ] })],
    width: { size: 100, type: WidthType.PERCENTAGE },
    shading: { fill: 'E0F3F8', type: ShadingType.SOLID } // Remplissage bleu cyan sur tout le tableau
  });

  children.push(marianneParagraph);
  children.push(para([text("MINISTÈRE DE L'ÉCONOMIE ET DES FINANCES", { bold: true })], { alignment: AlignmentType.CENTER, after: 40 }));
  children.push(para([text('Direction des Affaires Juridiques', { size: SS })], { alignment: AlignmentType.CENTER, after: 120 }));
  children.push(titleBoxTable);
  children.push(emptyLine(80));

  // A-D
  children.push(sectionTitle('A', "Identification du pouvoir adjudicateur ou de l'entité adjudicatrice"));
  [A.designation, A.adresse, [A.codePostal, A.ville].filter(Boolean).join(' ')].filter(Boolean).forEach(l => children.push(para([text(l)], { after: 40 })));
  children.push(emptyLine(200));
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
  children.push(sectionTitle('C', "Identification du maître d'œuvre"));
  children.push(para([text(C.nomCommercial || C.denominationSociale || dots(60))], { after: 40 }));
  children.push(emptyLine(200));
  children.push(sectionTitle('D', 'Objet du marché public'));
  if (D.objet) children.push(para([text(D.objet)], { after: 80 }));
  children.push(emptyLine(120));

  // E — Propositions
  children.push(sectionTitle('E', "Propositions du maître d'œuvre relatives au procès-verbal des opérations préalables à la réception des ouvrages"));
  children.push(para([text(`Au vu du procès-verbal des opérations préalables à la réception des ouvrages, en date du ${formatDate(data.dateOPR)} (date PV des OPR), je, soussigné, maître d'œuvre, propose :`)], { after: 120 }));

  const prononcer = data.propositionMoe === 'prononcer';

  children.push(para([text(`1.  de prononcer la réception, en retenant, pour l'achèvement des travaux, la date du ${formatDate(data.dateAchevementRetenue)}`, { bold: true })], { after: 80, indent: { left: 200 } }));
  children.push(para([text("Cette réception serait prononcée :")], { after: 60, indent: { left: 400 } }));

  children.push(chkLine(prononcer && data.typeReception === 'sans_reserve', "sans réserve.", { indent: 600 }));
  children.push(chkLine(prononcer && data.typeReception === 'sous_reserve', "sous réserve :", { indent: 600 }));

  const hasEpreuvesReserve = data.epreuves === 'exceptions';
  const hasTravauxReserve = data.travauxExputes === 'exceptions';
  children.push(chkLine(hasEpreuvesReserve, `de l'exécution concluante des épreuves énumérées à l'annexe n° ${data.epreuvesExceptions || dots(15)} ci-jointe.`, { indent: 800 }));
  children.push(chkLine(hasTravauxReserve, `de l'exécution des travaux et prestations énumérés à l'annexe n° ${data.travauxExceptions || dots(15)} ci-jointe.`, { indent: 800 }));

  children.push(chkLine(prononcer && data.typeReception === 'avec_reserve', "avec réserve :", { indent: 600 }));

  const hasOuvragesReserve = data.ouvragesConformes === 'exceptions';
  const reserves = (data.reserves || []).filter(r => r.designation);
  const premierDelai = reserves.length > 0 ? formatDate(reserves[0].delaiLevee) : blankDate;
  children.push(chkLine(hasOuvragesReserve, `le titulaire doit remédier, avant le ${premierDelai}, aux imperfections et malfaçons indiquées à l'annexe n° ${data.ouvragesExceptions || dots(15)} ci-jointe.`, { indent: 800 }));

  const hasRefaction = !!data.refactionMontant;
  children.push(chkLine(hasRefaction, `Toutefois, il est proposé que cette dernière réserve soit levée, si le titulaire du marché public accepte une réfaction égale en prix de base à : ${data.refactionMontant || dots(20)}.`, { indent: 1100, size: SS }));

  const hasRepli = data.repliInstallations === 'non';
  children.push(chkLine(hasRepli, `les installations de chantier doivent être repliées et les terrains et les lieux doivent être remis en état, avant le ${formatDate(data.delaiRepliInstallations)}.`, { indent: 800 }));

  const hasPose = data.poseEquipements === 'non_conforme';
  children.push(chkLine(hasPose, `les conditions de pose des équipements doivent être mises en conformité avec les spécifications des fournisseurs, avant le ${formatDate(data.delaiMiseConformiteEquipements)}.`, { indent: 800 }));

  children.push(para([text(`2.  de ne pas prononcer la réception.`, { bold: data.propositionMoe === 'ne_pas_prononcer' })], { after: 120, indent: { left: 200 } }));
  children.push(emptyLine(200));

  // F — Signature MOE
  children.push(sectionTitle('F', "Signature du maître d'œuvre"));
  children.push(emptyLine(100));
  children.push(para([text(`A : ${data.lieuSignatureMoe || dots(25)}, le ${formatDate(data.dateSignatureMoe)}`)], { alignment: AlignmentType.RIGHT, after: 80 }));
  children.push(para([text('Signature', { bold: true })], { alignment: AlignmentType.RIGHT, after: 40 }));

  // Image signature MOE
  const moeSigDocx5 = await loadMoeSignatureWithDimensions();
  if (moeSigDocx5) {
    try {
      const base64Data = moeSigDocx5.dataUrl.split(',')[1];
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      const sigMaxW = 150, sigMaxH = 80;
      const sigRatio = Math.min(sigMaxW / moeSigDocx5.width, sigMaxH / moeSigDocx5.height, 1);
      children.push(new Paragraph({
        children: [new ImageRun({ data: bytes, transformation: { width: Math.round(moeSigDocx5.width * sigRatio), height: Math.round(moeSigDocx5.height * sigRatio) } })],
        alignment: AlignmentType.RIGHT, spacing: { after: 100 },
      }));
    } catch { /* skip */ }
  }

  children.push(emptyLine(200));
  // Pied de page
  children.push(para([text('Date de mise à jour : 01/04/2019.', { size: 16 })], { after: 0 }));

  // Annexe des réserves
  const annexeChildren = await generateAnnexeReservesDocx(data, 'EXE5', fiche);
  children.push(...annexeChildren);

  const doc = new Document({ sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 1080, right: 1080 } } }, children }] });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `EXE5_${(fiche.nom || 'propositions-moe').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.docx`);
};