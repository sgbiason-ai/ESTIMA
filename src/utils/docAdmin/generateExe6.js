// src/utils/docAdmin/generateExe6.js
// Génération EXE6 — Décision de Réception
// Conforme au formulaire officiel (DAJ - mise à jour 01/04/2019)
import { saveAs } from 'file-saver';
import { generateAnnexeReservesPdf, generateAnnexeReservesDocx } from './annexeReserves.js';
import { formatDateLocale } from '../dateHelpers';

const dots = (n = 40) => '.'.repeat(n);
const formatDate = (s) => formatDateLocale(s, { fallback: dots(20) });

const CHK = '☒';
const UNCHK = '☐';

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

// ─── EXPORT PDF ─────────────────────────────────────────────────────────────
export const exportExe6Pdf = async (fiche, rawData) => {
  // Auto-dérivation des dates (fallbacks logiques)
  const data = { ...rawData };
  if (!data.dateSignatureMoe && data.dateOPR) data.dateSignatureMoe = data.dateOPR;
  if (!data.dateAchevementRetenue && data.dateAchevementProposee) data.dateAchevementRetenue = data.dateAchevementProposee;
  if (!data.dateSignaturePA && data.dateOPR) data.dateSignaturePA = data.dateOPR;
  if (!data.lieuSignaturePA) data.lieuSignaturePA = fiche.sectionA?.ville || '';

  const { default: jsPDF } = await import('jspdf');

  const A = fiche.sectionA || {}, B = fiche.sectionB || {}, C = fiche.sectionC || {}, D = fiche.sectionD || {};
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth(), pageH = pdf.internal.pageSize.getHeight();
  const mL = 20, mR = 20, cW = pageW - mL - mR;
  let y = 18;
  const BG_COLOR = [176, 224, 242], BLACK = [0, 0, 0]; // Bleu cyan #B0E0F2 (style DAJ)
  const MARIANNE_B64 = await loadMarianneImage();
  const FN = 10, FS = 9, FT = 11, LH = 5;

  const checkPage = (n = 20) => { if (y + n > pageH - 20) { pdf.addPage(); y = 18; } };
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

  // ── En-tête (style DAJ — logo Marianne + rectangle cyan) ──
  if (MARIANNE_B64 && MARIANNE_B64.length > 10) {
    const logoW = 35, logoH = 20;
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
  pdf.setFontSize(FT);
  pdf.text('RÉCEPTION DES TRAVAUX', pageW / 2, boxTitleY + 15, { align: 'center' });
  pdf.setFontSize(FN); pdf.setFont('helvetica', 'normal');
  pdf.text('DÉCISION DE RÉCEPTION', pageW / 2, boxTitleY + 21, { align: 'center' });
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(22);
  pdf.text('EXE6', pageW - mR - 5, boxTitleY + 17, { align: 'right' });

  y = boxTitleY + boxTitleH + 10;

  // A — Maître de l'ouvrage
  drawSectionTitle('A', "Identification du maître de l'ouvrage");
  [A.designation, A.adresse, [A.codePostal, A.ville].filter(Boolean).join('  ')].filter(Boolean).forEach(l => writeText(l, { after: 0 }));
  y += 8;

  // B
  drawSectionTitle('B', 'Identification du titulaire du marché public');
  const cotraitantsB_pdf6 = Array.isArray(B.cotraitants) ? B.cotraitants.filter(c => c?.nomCommercial || c?.denominationSociale) : [];
  const allEntsB_pdf6 = [
    { ent: B.mandataire, label: cotraitantsB_pdf6.length > 0 ? 'Mandataire' : null },
    ...cotraitantsB_pdf6.map((cot, i) => ({ ent: cot, label: `Co-traitant ${i + 1}` })),
  ];

  if (allEntsB_pdf6.length <= 1) {
    writeEntreprise(B.mandataire);
  } else {
    const nB6 = allEntsB_pdf6.length;
    const gapB6 = 8;
    const colWB6 = (cW - gapB6 * (nB6 - 1)) / nB6;

    const getLinesB6 = (ent, label) => {
      const lines = [];
      if (label) lines.push({ t: label, bold: true });
      [ent?.nomCommercial, ent?.denominationSociale ? `(${ent.denominationSociale})` : '', ent?.adresse,
        [ent?.codePostal, ent?.ville].filter(Boolean).join('  '),
        ent?.email ? `Email : ${ent.email}` : '',
        ent?.siret ? `SIRET : ${ent.siret}` : ''].filter(Boolean).forEach(t => lines.push({ t }));
      return lines;
    };

    const renderedColsB6 = allEntsB_pdf6.map(({ ent, label }) => {
      const rendered = [];
      getLinesB6(ent, label).forEach(line => {
        pdf.setFont('helvetica', line.bold ? 'bold' : 'normal');
        pdf.setFontSize(FN);
        pdf.splitTextToSize(line.t, colWB6).forEach(l => rendered.push({ t: l, bold: line.bold || false }));
      });
      return rendered;
    });

    const maxRowsB6 = Math.max(...renderedColsB6.map(c => c.length));
    checkPage(maxRowsB6 * LH + 6);
    const startYB6 = y;

    renderedColsB6.forEach((lines, colIdx) => {
      const colX = mL + colIdx * (colWB6 + gapB6);
      lines.forEach((line, li) => {
        pdf.setFont('helvetica', line.bold ? 'bold' : 'normal');
        pdf.setFontSize(FN);
        pdf.setTextColor(...BLACK);
        pdf.text(line.t, colX, startYB6 + li * LH);
      });
    });
    y = startYB6 + maxRowsB6 * LH + 4;
  }
  y += 8;

  // C
  drawSectionTitle('C', "Identification du maître d'œuvre");
  writeEntreprise(C); y += 8;

  // D
  drawSectionTitle('D', 'Objet du marché public');
  if (D.objet) writeText(D.objet, { after: 2 }); y += 5;

  // E — Objet de la décision
  drawSectionTitle('E', 'Objet de la décision de réception');
  writeText("La présente décision a pour objet la réception des prestations désignées ci-dessous :", { after: 3 });
  if (data.porteeReception === 'partielle' && data.designationPartielle) {
    writeText(data.designationPartielle, { size: FS, after: 3 });
  } else if (D.objet) {
    writeText(D.objet, { size: FS, after: 3 });
  }
  y += 5;

  // F — Décision du maître de l'ouvrage
  drawSectionTitle('F', "Décision du maître de l'ouvrage");
  writeText("Au vu :", { after: 2 });

  writeCheckLine(true, `du procès-verbal des opérations préalables à la réception, en date du ${formatDate(data.dateOPR)}, et des propositions présentées le ${formatDate(data.dateSignatureMoe)} par le maître d'œuvre ;`, { after: 3 });

  const hasRefaction = !!data.refactionMontant;
  writeCheckLine(hasRefaction, `de la lettre, en date du ${data.dateLettreRefaction ? formatDate(data.dateLettreRefaction) : dots(20)}, par laquelle le titulaire du marché public accepte la réfaction proposée ;`, { after: 5 });

  writeText("le maître de l'ouvrage décide :", { after: 2 });

  const prononcer = data.decisionPA === 'prononcer';

  // 1. Date d'achèvement
  writeText(`1.  que la date retenue, pour l'achèvement des travaux, est fixée au ${formatDate(data.dateAchevementRetenue)}`, { bold: true, indentLeft: 5, after: 4 });

  // 2. Réception prononcée
  writeText("2.  que la réception est prononcée ;", { bold: prononcer, indentLeft: 5, after: 2 });

  // 2.1 Sans réserve
  writeCheckLine(prononcer && data.typeReception === 'sans_reserve', "sans réserve.", { indentLeft: 16, after: 4 });

  // 2.2 Sous réserve
  writeCheckLine(prononcer && data.typeReception === 'sous_reserve', "sous réserve :", { indentLeft: 16, after: 2 });

  const hasEpreuvesReserve = data.epreuves === 'exceptions';
  const hasTravauxReserve = data.travauxExputes === 'exceptions';
  const hasOuvragesReserve = data.ouvragesConformes === 'exceptions';
  const reserves = (data.reserves || []).filter(r => r.designation);
  const premierDelai = reserves.length > 0 ? formatDate(reserves[0].delaiLevee) : dots(20);

  writeCheckLine(hasEpreuvesReserve, `de l'exécution concluante des épreuves énumérées à l'annexe n° ${data.epreuvesExceptions || dots(12)} ci-jointe.`, { indentLeft: 22, after: 3 });
  writeCheckLine(hasTravauxReserve, `de l'exécution des travaux et prestations, énumérés à l'annexe n° ${data.travauxExceptions || dots(12)} ci-jointe, avant le ${premierDelai}`, { indentLeft: 22, after: 4 });

  // 2.3 Avec réserve
  writeCheckLine(prononcer && data.typeReception === 'avec_reserve', "avec réserve :", { indentLeft: 16, after: 2 });
  writeCheckLine(hasOuvragesReserve, `le titulaire doit remédier, avant le ${premierDelai}, aux imperfections et malfaçons indiquées à l'annexe n° ${data.ouvragesExceptions || dots(12)} ci-jointe.`, { indentLeft: 24, after: 2 });

  writeCheckLine(hasRefaction, `Toutefois, il est proposé que cette dernière réserve soit levée, si le titulaire du marché public accepte une réfaction égale en prix de base à : ${data.refactionMontant || dots(20)}.`, { indentLeft: 30, size: FS, after: 4 });

  const hasRepli = data.repliInstallations === 'non';
  writeCheckLine(hasRepli, `les installations de chantier doivent être repliées et les terrains et les lieux doivent être remis en état, avant le ${data.delaiRepliInstallations ? formatDate(data.delaiRepliInstallations) : dots(20)}.`, { indentLeft: 24, after: 3 });

  const hasPose = data.poseEquipements === 'non_conforme';
  writeCheckLine(hasPose, `les conditions de pose des équipements doivent être mises en conformité avec les spécifications des fournisseurs, avant le ${data.delaiMiseConformiteEquipements ? formatDate(data.delaiMiseConformiteEquipements) : dots(20)}.`, { indentLeft: 24, after: 6 });

  // G — Signature du maître de l'ouvrage
  checkPage(50);
  drawSectionTitle('G', "Signature du maître de l'ouvrage");
  y += 5;
  writeText(`A : ${data.lieuSignaturePA || dots(25)}, le ${formatDate(data.dateSignaturePA)}`, { align: 'right', after: 18 });
  writeText('Signature', { align: 'right', bold: true, after: 2 });

  // Annexe des réserves (si présentes)
  await generateAnnexeReservesPdf(pdf, data, 'EXE6', fiche);

  pdf.save(`EXE6_${(fiche.nom || 'decision-reception').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
  return 'pdf';
};

// ─── EXPORT DOCX ────────────────────────────────────────────────────────────
export const exportExe6Docx = async (fiche, rawData) => {
  // Auto-dérivation des dates (fallbacks logiques)
  const data = { ...rawData };
  if (!data.dateSignatureMoe && data.dateOPR) data.dateSignatureMoe = data.dateOPR;
  if (!data.dateAchevementRetenue && data.dateAchevementProposee) data.dateAchevementRetenue = data.dateAchevementProposee;
  if (!data.dateSignaturePA && data.dateOPR) data.dateSignaturePA = data.dateOPR;
  if (!data.lieuSignaturePA) data.lieuSignaturePA = fiche.sectionA?.ville || '';
  const { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, VerticalAlign } = await import('docx');
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
          para([text("MINISTÈRE DE L'ÉCONOMIE ET DES FINANCES", { bold: true })], { after: 40 }),
          para([text('Direction des Affaires Juridiques', { size: SS })], { after: 80 }),
          para([text('MARCHÉS PUBLICS', { bold: true, size: ST })], { after: 40 }),
          para([text('RÉCEPTION DES TRAVAUX', { bold: true })], { after: 60 }),
          para([text('DÉCISION DE RÉCEPTION', { size: SS })], { after: 0 }),
        ],
        borders: { top: BT, bottom: BT, left: BT, right: BN }, width: { size: 80, type: WidthType.PERCENTAGE },
      }),
      new TableCell({
        children: [emptyLine(200), para([text('EXE6', { bold: true, size: SL })], { alignment: AlignmentType.CENTER, after: 0 })],
        borders: { top: BT, bottom: BT, left: BN, right: BT },
        width: { size: 20, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER,
      }),
    ] })],
    width: { size: 100, type: WidthType.PERCENTAGE },
  }));
  children.push(emptyLine(80));

  // A — Maître de l'ouvrage
  children.push(sectionTitle('A', "Identification du maître de l'ouvrage"));
  [A.designation, A.adresse, [A.codePostal, A.ville].filter(Boolean).join(' ')].filter(Boolean).forEach(l => children.push(para([text(l)], { after: 40 })));
  children.push(emptyLine(200));

  // B
  children.push(sectionTitle('B', 'Identification du titulaire du marché public'));
  const cotraitantsB_docx6 = Array.isArray(B.cotraitants) ? B.cotraitants.filter(c => c?.nomCommercial || c?.denominationSociale) : [];

  const getEntParasB6 = (ent, label) => {
    const paras = [];
    if (label) paras.push(para([text(label, { bold: true, size: SS })], { after: 20 }));
    [ent?.nomCommercial, ent?.denominationSociale ? `(${ent.denominationSociale})` : '', ent?.adresse,
      [ent?.codePostal, ent?.ville].filter(Boolean).join('  '),
      ent?.email ? `Email : ${ent.email}` : '',
      ent?.siret ? `SIRET : ${ent.siret}` : ''].filter(Boolean)
      .forEach(l => paras.push(para([text(l)], { after: 20 })));
    return paras;
  };

  if (cotraitantsB_docx6.length === 0) {
    getEntParasB6(B.mandataire, null).forEach(p => children.push(p));
  } else {
    const allEntsB_docx6 = [
      { ent: B.mandataire, label: 'Mandataire' },
      ...cotraitantsB_docx6.map((cot, i) => ({ ent: cot, label: `Co-traitant ${i + 1}` })),
    ];
    const colPctB6 = Math.floor(100 / allEntsB_docx6.length);
    children.push(new Table({
      rows: [new TableRow({
        children: allEntsB_docx6.map(({ ent, label }) => new TableCell({
          children: getEntParasB6(ent, label),
          borders: { top: BN, bottom: BN, left: BN, right: BN },
          width: { size: colPctB6, type: WidthType.PERCENTAGE },
        })),
      })],
      width: { size: 100, type: WidthType.PERCENTAGE },
    }));
  }
  children.push(emptyLine(200));

  // C
  children.push(sectionTitle('C', "Identification du maître d'œuvre"));
  getEntParasB6(C, null).forEach(p => children.push(p));
  children.push(emptyLine(200));
  children.push(sectionTitle('D', 'Objet du marché public'));
  if (D.objet) children.push(para([text(D.objet)], { after: 80 }));
  children.push(emptyLine(120));

  // E — Objet
  children.push(sectionTitle('E', 'Objet de la décision de réception'));
  children.push(para([text("La présente décision a pour objet la réception des prestations désignées ci-dessous :")], { after: 80 }));
  if (data.porteeReception === 'partielle' && data.designationPartielle) {
    children.push(para([text(data.designationPartielle, { size: SS })], { after: 80 }));
  } else if (D.objet) {
    children.push(para([text(D.objet, { size: SS })], { after: 80 }));
  }
  children.push(emptyLine(120));

  // F — Décision
  children.push(sectionTitle('F', "Décision du maître de l'ouvrage"));
  children.push(para([text("Au vu :")], { after: 60 }));

  children.push(chkLine(true, `du procès-verbal des opérations préalables à la réception, en date du ${formatDate(data.dateOPR)}, et des propositions présentées le ${formatDate(data.dateSignatureMoe)} par le maître d'œuvre ;`));

  const hasRefaction = !!data.refactionMontant;
  children.push(chkLine(hasRefaction, `de la lettre, en date du ${data.dateLettreRefaction ? formatDate(data.dateLettreRefaction) : dots(20)}, par laquelle le titulaire du marché public accepte la réfaction proposée ;`));

  children.push(para([text("le maître de l'ouvrage décide :")], { after: 60, before: 80 }));

  const prononcer = data.decisionPA === 'prononcer';

  children.push(para([text(`1.  que la date retenue, pour l'achèvement des travaux, est fixée au ${formatDate(data.dateAchevementRetenue)}`, { bold: true })], { after: 100, indent: { left: 200 } }));
  children.push(para([text("2.  que la réception est prononcée ;", { bold: prononcer })], { after: 60, indent: { left: 200 } }));

  children.push(chkLine(prononcer && data.typeReception === 'sans_reserve', "sans réserve.", { indent: 600 }));
  children.push(chkLine(prononcer && data.typeReception === 'sous_reserve', "sous réserve :", { indent: 600 }));
  const hasEpreuvesReserve = data.epreuves === 'exceptions';
  const hasTravauxReserve = data.travauxExputes === 'exceptions';
  const hasOuvragesReserve = data.ouvragesConformes === 'exceptions';
  const reserves = (data.reserves || []).filter(r => r.designation);
  const premierDelai = reserves.length > 0 ? formatDate(reserves[0].delaiLevee) : dots(20);

  children.push(chkLine(hasEpreuvesReserve, `de l'exécution concluante des épreuves énumérées à l'annexe n° ${data.epreuvesExceptions || dots(15)} ci-jointe.`, { indent: 800 }));
  children.push(chkLine(hasTravauxReserve, `de l'exécution des travaux et prestations, énumérés à l'annexe n° ${data.travauxExceptions || dots(15)} ci-jointe, avant le ${premierDelai}`, { indent: 800 }));

  children.push(chkLine(prononcer && data.typeReception === 'avec_reserve', "avec réserve :", { indent: 600 }));
  children.push(chkLine(hasOuvragesReserve, `le titulaire doit remédier, avant le ${premierDelai}, aux imperfections et malfaçons indiquées à l'annexe n° ${data.ouvragesExceptions || dots(15)} ci-jointe.`, { indent: 800 }));
  children.push(chkLine(hasRefaction, `Toutefois, il est proposé que cette dernière réserve soit levée, si le titulaire du marché public accepte une réfaction égale en prix de base à : ${data.refactionMontant || dots(20)}.`, { indent: 1100, size: SS }));

  const hasRepli = data.repliInstallations === 'non';
  children.push(chkLine(hasRepli, `les installations de chantier doivent être repliées et les terrains et les lieux doivent être remis en état, avant le ${data.delaiRepliInstallations ? formatDate(data.delaiRepliInstallations) : dots(20)}.`, { indent: 800 }));

  const hasPose = data.poseEquipements === 'non_conforme';
  children.push(chkLine(hasPose, `les conditions de pose des équipements doivent être mises en conformité avec les spécifications des fournisseurs, avant le ${data.delaiMiseConformiteEquipements ? formatDate(data.delaiMiseConformiteEquipements) : dots(20)}.`, { indent: 800 }));

  children.push(emptyLine(200));

  // G — Signature du maître de l'ouvrage
  children.push(sectionTitle('G', "Signature du maître de l'ouvrage"));
  children.push(emptyLine(100));
  children.push(para([text(`A : ${data.lieuSignaturePA || dots(25)}, le ${formatDate(data.dateSignaturePA)}`)], { alignment: AlignmentType.RIGHT, after: 200 }));
  children.push(para([text('Signature', { bold: true })], { alignment: AlignmentType.RIGHT, after: 40 }));

  // Annexe des réserves (si présentes)
  const annexeChildren = await generateAnnexeReservesDocx(data, 'EXE6', fiche);
  children.push(...annexeChildren);

  const doc = new Document({ sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 1080, right: 1080 } } }, children }] });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `EXE6_${(fiche.nom || 'decision-reception').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.docx`);
};
