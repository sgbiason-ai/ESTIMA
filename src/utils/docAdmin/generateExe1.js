// src/utils/docAdmin/generateExe1.js
// Génération du document EXE1-T (Ordre de Service) au format .docx
// Reproduit fidèlement la structure officielle du formulaire ministériel

import { saveAs } from 'file-saver';
import { loadMoeSignatureWithDimensions } from './moeDefaults.js';
import { formatDateLocale } from '../dateHelpers';

let Document, Packer, Paragraph, TextRun, AlignmentType,
    Table, TableRow, TableCell, WidthType, BorderStyle,
    HeadingLevel, PageBreak, Header, Footer, PageNumber,
    ShadingType, VerticalAlign, TabStopPosition, TabStopType,
    ImageRun;

let BORDER_THIN, BORDER_NONE, SHADING_GRAY;

const ensureDocx = async () => {
  if (Document) return;
  const docx = await import('docx');
  ({ Document, Packer, Paragraph, TextRun, AlignmentType,
     Table, TableRow, TableCell, WidthType, BorderStyle,
     HeadingLevel, PageBreak, Header, Footer, PageNumber,
     ShadingType, VerticalAlign, TabStopPosition, TabStopType,
     ImageRun } = docx);
  BORDER_THIN = { style: BorderStyle.SINGLE, size: 1, color: '000000' };
  BORDER_NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  SHADING_GRAY = { type: ShadingType.SOLID, color: 'D9D9D9' };
};

// ─── CONSTANTES ─────────────────────────────────────────────────────────────
const FONT = 'Arial';
const SIZE_NORMAL = 20;     // 10pt
const SIZE_SMALL = 18;      // 9pt
const SIZE_TITLE = 22;      // 11pt
const SIZE_HEADER = 24;     // 12pt
const SIZE_LARGE = 28;      // 14pt

// ─── HELPERS ────────────────────────────────────────────────────────────────

const text = (content, opts = {}) => new TextRun({
  text: content,
  font: FONT,
  size: opts.size || SIZE_NORMAL,
  bold: opts.bold || false,
  italics: opts.italics || false,
  ...opts,
});

const para = (children, opts = {}) => new Paragraph({
  children: Array.isArray(children) ? children : [children],
  spacing: { after: opts.after ?? 120, before: opts.before ?? 0 },
  alignment: opts.alignment || AlignmentType.LEFT,
  indent: opts.indent,
  ...opts,
});

const emptyLine = (after = 60) => para([text('')], { after });

const sectionTitle = (letter, title) => new Table({
  rows: [
    new TableRow({
      children: [
        new TableCell({
          children: [
            para([text(`${letter} - ${title}`, { bold: true, size: SIZE_TITLE })], { after: 0 }),
          ],
          shading: SHADING_GRAY,
          borders: {
            top: BORDER_THIN, bottom: BORDER_THIN,
            left: BORDER_THIN, right: BORDER_THIN,
          },
          verticalAlign: VerticalAlign.CENTER,
          width: { size: 100, type: WidthType.PERCENTAGE },
        }),
      ],
    }),
  ],
  width: { size: 100, type: WidthType.PERCENTAGE },
});

const dots = (count = 40) => '.'.repeat(count);

const OS_TYPE_LABELS_PDF = {
  preparation: 'de démarrage de la période de préparation',
  demarrage: 'de démarrage des travaux',
  arret: "d'arrêt des travaux",
  reprise: 'de reprise des travaux',
};

const OS_TYPE_LABELS_DOCX = {
  preparation: 'de démarrage de la période de préparation',
  demarrage: 'de démarrage des travaux',
  arret: "d'arrêt des travaux",
  reprise: 'de reprise des travaux',
};

const formatDate = (s) => formatDateLocale(s, { fallback: dots(20) });

const formatEntreprise = (ent) => {
  if (!ent) return dots(60);
  const parts = [];
  if (ent.nomCommercial) parts.push(ent.nomCommercial);
  if (ent.denominationSociale) parts.push(`(${ent.denominationSociale})`);
  if (ent.adresse) parts.push(ent.adresse);
  if (ent.codePostal || ent.ville) parts.push(`${ent.codePostal || ''} ${ent.ville || ''}`.trim());
  if (ent.email) parts.push(`Email : ${ent.email}`);
  if (ent.telephone) parts.push(`Tél. : ${ent.telephone}`);
  if (ent.telecopie) parts.push(`Fax : ${ent.telecopie}`);
  if (ent.siret) parts.push(`SIRET : ${ent.siret}`);
  return parts.join('\n');
};

const multilineParagraphs = (content, opts = {}) => {
  if (!content) return [para([text(dots(60))], opts)];
  return content.split('\n').map((line) =>
    para([text(line.trim(), { size: opts.size || SIZE_NORMAL })], { after: 40, ...opts })
  );
};

// ─── CONSTRUCTION DU DOCUMENT ───────────────────────────────────────────────

export const generateExe1Document = async (fiche, exe1Data) => {
  await ensureDocx();
  const A = fiche.sectionA || {};
  const B = fiche.sectionB || {};
  const C = fiche.sectionC || {};
  const D = fiche.sectionD || {};

  const children = [];

  // ── HEADER ────────────────────────────────────────────────────────────────
  children.push(
    new Table({
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [
                para([text('MINISTÈRE DE L\'ÉCONOMIE ET DES FINANCES', { bold: true, size: SIZE_NORMAL })], { after: 40 }),
                para([text('Direction des Affaires Juridiques', { size: SIZE_SMALL })], { after: 80 }),
                para([text('MARCHÉS PUBLICS ET ACCORDS-CADRES', { bold: true, size: SIZE_TITLE })], { after: 40 }),
                para([text('MARCHÉS DE TRAVAUX', { bold: true, size: SIZE_NORMAL })], { after: 80 }),
                para([
                  text('ORDRE DE SERVICE N° ', { bold: true, size: SIZE_LARGE }),
                  text(exe1Data.numeroOrdreService || dots(20), { bold: true, size: SIZE_LARGE }),
                ], { after: 40 }),
                para([
                  text(OS_TYPE_LABELS_DOCX[exe1Data.typeOS] || OS_TYPE_LABELS_DOCX.demarrage, { bold: true, size: SIZE_TITLE }),
                ], { after: 0 }),
              ],
              borders: { top: BORDER_THIN, bottom: BORDER_THIN, left: BORDER_THIN, right: BORDER_NONE },
              width: { size: 80, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
              children: [
                emptyLine(200),
                para([text('EXE1-T', { bold: true, size: SIZE_LARGE })], { alignment: AlignmentType.CENTER, after: 0 }),
              ],
              borders: { top: BORDER_THIN, bottom: BORDER_THIN, left: BORDER_NONE, right: BORDER_THIN },
              width: { size: 20, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.CENTER,
            }),
          ],
        }),
      ],
      width: { size: 100, type: WidthType.PERCENTAGE },
    })
  );

  children.push(emptyLine(200));

  // ── SECTION A ─────────────────────────────────────────────────────────────
  children.push(sectionTitle('A', "Identification du pouvoir adjudicateur ou de l'entité adjudicatrice"));

  // Contenu Section A
  const aContent = [
    A.designation,
    A.adresse,
    [A.codePostal, A.ville].filter(Boolean).join(' '),
    A.telephone ? `Tél. : ${A.telephone}` : '',
    A.email ? `Email : ${A.email}` : '',
    A.representant ? `Représentant : ${A.representant}${A.qualite ? ` (${A.qualite})` : ''}` : '',
  ].filter(Boolean).join('\n');
  children.push(...multilineParagraphs(aContent || null));
  children.push(emptyLine(120));

  // ── SECTION B ─────────────────────────────────────────────────────────────
  children.push(sectionTitle('B', 'Identification du titulaire du marché public'));

  // Contenu Section B
  if (B.type === 'groupement') {
    children.push(
      para([text(`Groupement ${B.typeGroupement || 'solidaire'} :`, { bold: true, size: SIZE_NORMAL })], { after: 80 })
    );
    children.push(
      para([text('Mandataire :', { bold: true, size: SIZE_SMALL })], { after: 40 })
    );
    children.push(...multilineParagraphs(formatEntreprise(B.mandataire)));
    children.push(emptyLine(60));

    (B.cotraitants || []).forEach((cot, idx) => {
      children.push(
        para([text(`Co-traitant ${idx + 1} :`, { bold: true, size: SIZE_SMALL })], { after: 40 })
      );
      children.push(...multilineParagraphs(formatEntreprise(cot)));
      children.push(emptyLine(60));
    });
  } else {
    children.push(...multilineParagraphs(formatEntreprise(B.mandataire)));
  }
  children.push(emptyLine(120));

  // ── SECTION C ─────────────────────────────────────────────────────────────
  children.push(sectionTitle('C', "Identification du maître d'œuvre"));
  children.push(...multilineParagraphs(formatEntreprise(C)));
  children.push(emptyLine(120));

  // ── SECTION D ─────────────────────────────────────────────────────────────
  children.push(sectionTitle('D', 'Objet du marché public'));

  if (D.objet) {
    children.push(para([text(D.objet, { size: SIZE_NORMAL })], { after: 80 }));
  }
  if (D.lots && D.lots.length > 0) {
    D.lots.forEach((lot) => {
      children.push(
        para([text(`Lot ${lot.numero || '?'} : ${lot.designation || ''}`, { size: SIZE_NORMAL })], { after: 40 })
      );
    });
  }

  children.push(emptyLine(60));
  children.push(
    para([
      text('■  ', { bold: true }),
      text('Référence du marché public : ', { size: SIZE_NORMAL }),
      text(D.referenceMarche || dots(40), { size: SIZE_NORMAL }),
    ], { after: 80 })
  );
  children.push(
    para([
      text('■  ', { bold: true }),
      text('Date de la notification du marché public : ', { size: SIZE_NORMAL }),
      text(formatDate(D.dateNotification), { size: SIZE_NORMAL }),
    ], { after: 80 })
  );
  children.push(
    para([
      text('■  ', { bold: true }),
      text('Durée d\'exécution du marché public : ', { size: SIZE_NORMAL }),
      text(`${(parseFloat(D.dureePeriodePreparation) || 0) + (parseFloat(D.dureeExecution) || 0) || dots(10)}`, { size: SIZE_NORMAL }),
      text(` mois${D.dureePeriodePreparation ? ` (dont ${D.dureePeriodePreparation} mois de préparation + ${D.dureeExecution || dots(5)} mois de travaux)` : ''}.`, { size: SIZE_NORMAL }),
    ], { after: 120 })
  );

  const docxLabelDate = exe1Data.typeOS === 'preparation'
    ? 'Date de démarrage de la période de préparation : '
    : 'Date de démarrage des travaux : ';
  children.push(
    para([
      text('■  ', { bold: true }),
      text(docxLabelDate, { bold: true, size: SIZE_NORMAL }),
      text(formatDate(exe1Data.dateDemarragePrestations), { bold: true, size: SIZE_NORMAL }),
    ], { after: 120 })
  );

  // ── SECTION E ─────────────────────────────────────────────────────────────
  children.push(sectionTitle('E', 'Prestations ordonnées'));
  children.push(emptyLine(60));

  children.push(
    para([
      text('■  ', { bold: true }),
      text('Adresse d\'exécution des prestations ordonnées :', { size: SIZE_NORMAL }),
    ], { after: 40 })
  );
  children.push(
    para([text(exe1Data.adresseExecution || D.adresseExecution || dots(60), { size: SIZE_NORMAL })], { after: 120 })
  );

  children.push(
    para([
      text('■  ', { bold: true }),
      text('Délai d\'exécution des prestations ordonnées : ', { size: SIZE_NORMAL }),
      text(exe1Data.delaiExecution
        || (exe1Data.typeOS === 'preparation' && D.dureePeriodePreparation ? `${D.dureePeriodePreparation} mois` : '')
        || (exe1Data.typeOS === 'demarrage' && D.dureeExecution ? `${D.dureeExecution} mois` : '')
        || dots(40), { size: SIZE_NORMAL }),
    ], { after: 120 })
  );

  children.push(
    para([
      text('■  ', { bold: true }),
      text('Autres précisions :', { size: SIZE_NORMAL }),
    ], { after: 40 })
  );
  if (exe1Data.autresPrecisions) {
    children.push(
      para([text(exe1Data.autresPrecisions, { size: SIZE_SMALL })], { after: 120 })
    );
  }

  // ── Tableau des prestations ───────────────────────────────────────────────
  const headerCells = ['Désignation des prestations ordonnées', 'Quantité', 'TVA', 'Prix unitaire HT', 'Montant HT'].map((label, i) =>
    new TableCell({
      children: [para([text(label, { bold: true, size: SIZE_SMALL })], { after: 0, alignment: AlignmentType.CENTER })],
      shading: SHADING_GRAY,
      borders: { top: BORDER_THIN, bottom: BORDER_THIN, left: BORDER_THIN, right: BORDER_THIN },
      verticalAlign: VerticalAlign.CENTER,
      width: i === 0
        ? { size: 40, type: WidthType.PERCENTAGE }
        : { size: 15, type: WidthType.PERCENTAGE },
    })
  );

  let docxTotalHT = 0;
  let docxTotalTVA = 0;

  // Si aucune prestation saisie, reprendre les lots
  let docxPrestations = (exe1Data.prestations || []).filter((p) => p.designation || p.quantite || p.prixUnitaire);
  if (docxPrestations.length === 0 && D.lots && D.lots.length > 0) {
    docxPrestations = D.lots.map((lot) => {
      const raw = (lot.montantHT || '').replace(/\s/g, '').replace(',', '.');
      return {
        designation: `Lot ${lot.numero || '?'} : ${lot.designation || ''}`.trim(),
        quantite: '1',
        tva: '20',
        prixUnitaire: raw && !isNaN(parseFloat(raw)) ? parseFloat(raw).toFixed(2) : '',
      };
    });
  }

  const dataRows = docxPrestations.map((p) => {
    const q = parseFloat(p.quantite) || 0;
    const pu = parseFloat(p.prixUnitaire) || 0;
    const tvaRate = parseFloat(p.tva) || 0;
    const montantHT = q * pu;
    const montantTVA = montantHT * tvaRate / 100;
    docxTotalHT += montantHT;
    docxTotalTVA += montantTVA;

    const values = [
      p.designation || '',
      p.quantite || '',
      tvaRate > 0 ? `${p.tva}%` : '',
      pu > 0 ? pu.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €' : '',
      montantHT > 0 ? montantHT.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €' : '',
    ];

    return new TableRow({
      children: values.map((val, i) =>
        new TableCell({
          children: [para([text(val, { size: SIZE_SMALL })], {
            after: 0,
            alignment: i === 0 ? AlignmentType.LEFT : AlignmentType.CENTER,
          })],
          borders: { top: BORDER_THIN, bottom: BORDER_THIN, left: BORDER_THIN, right: BORDER_THIN },
          verticalAlign: VerticalAlign.CENTER,
        })
      ),
    });
  });

  // Ligne vide si aucune prestation
  if (dataRows.length === 0) {
    dataRows.push(
      new TableRow({
        children: Array(5).fill(null).map(() =>
          new TableCell({
            children: [para([text(' ')], { after: 0 })],
            borders: { top: BORDER_THIN, bottom: BORDER_THIN, left: BORDER_THIN, right: BORDER_THIN },
          })
        ),
      })
    );
  }

  children.push(
    new Table({
      rows: [new TableRow({ children: headerCells }), ...dataRows],
      width: { size: 100, type: WidthType.PERCENTAGE },
    })
  );

  // Récapitulatif HT / TVA / TTC
  const docxTotalTTC = docxTotalHT + docxTotalTVA;
  const fmtDocx = (n) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €';

  const summaryRows = [
    { label: 'Total HT', value: fmtDocx(docxTotalHT) },
    { label: 'TVA', value: fmtDocx(docxTotalTVA) },
    { label: 'Total TTC', value: fmtDocx(docxTotalTTC) },
  ].map((row) =>
    new TableRow({
      children: [
        new TableCell({
          children: [para([text(row.label, { bold: true, size: SIZE_SMALL })], { after: 0, alignment: AlignmentType.RIGHT })],
          borders: { top: BORDER_THIN, bottom: BORDER_THIN, left: BORDER_THIN, right: BORDER_THIN },
          verticalAlign: VerticalAlign.CENTER,
          width: { size: 50, type: WidthType.PERCENTAGE },
        }),
        new TableCell({
          children: [para([text(row.value, { size: SIZE_SMALL })], { after: 0, alignment: AlignmentType.RIGHT })],
          borders: { top: BORDER_THIN, bottom: BORDER_THIN, left: BORDER_THIN, right: BORDER_THIN },
          verticalAlign: VerticalAlign.CENTER,
          width: { size: 50, type: WidthType.PERCENTAGE },
        }),
      ],
    })
  );

  children.push(emptyLine(60));
  children.push(
    new Table({
      rows: summaryRows,
      width: { size: 35, type: WidthType.PERCENTAGE },
    })
  );
  children.push(emptyLine(200));

  // ── SECTION F — Signature MOE ─────────────────────────────────────────────
  children.push(sectionTitle('F', "Signature du maître d'œuvre"));
  children.push(emptyLine(200));
  children.push(
    para([
      text(`A ${exe1Data.lieuSignatureMoe || dots(25)}, le ${formatDate(exe1Data.dateSignatureMoe)}`, { size: SIZE_NORMAL }),
    ], { alignment: AlignmentType.RIGHT, after: 200 })
  );
  children.push(emptyLine(200));
  children.push(
    para([text('Signature', { size: SIZE_NORMAL })], { alignment: AlignmentType.RIGHT, after: 40 })
  );
  children.push(
    para([text("(maître d'œuvre)", { italics: true, size: SIZE_SMALL })], { alignment: AlignmentType.RIGHT, after: 100 })
  );

  // Image signature/tampon MOE
  const moeSigDocx1 = await loadMoeSignatureWithDimensions();
  if (moeSigDocx1) {
    try {
      const base64Data = moeSigDocx1.dataUrl.split(',')[1];
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      const sigMaxW = 150, sigMaxH = 80;
      const sigRatio = Math.min(sigMaxW / moeSigDocx1.width, sigMaxH / moeSigDocx1.height, 1);
      children.push(new Paragraph({
        children: [new ImageRun({ data: bytes, transformation: { width: Math.round(moeSigDocx1.width * sigRatio), height: Math.round(moeSigDocx1.height * sigRatio) } })],
        alignment: AlignmentType.RIGHT, spacing: { after: 200 },
      }));
    } catch { /* skip */ }
  }

  // ── SECTION G — Accusé de réception ───────────────────────────────────────
  children.push(sectionTitle('G', "Accusé de réception de l'ordre de service, par le titulaire du marché public"));
  children.push(emptyLine(80));
  children.push(
    para([
      text('Reçu le présent ordre de service le ', { size: SIZE_NORMAL }),
      text(formatDate(exe1Data.dateReception), { size: SIZE_NORMAL }),
    ], { after: 120 })
  );

  children.push(
    para([text('Observations éventuelles :', { size: SIZE_NORMAL })], { after: 40 })
  );
  if (exe1Data.observations) {
    children.push(
      para([text(exe1Data.observations, { size: SIZE_SMALL })], { after: 200 })
    );
  } else {
    children.push(emptyLine(200));
  }

  children.push(
    para([
      text(`A ${exe1Data.lieuSignatureTitulaire || dots(25)}, le ${formatDate(exe1Data.dateSignatureTitulaire)}`, { size: SIZE_NORMAL }),
    ], { alignment: AlignmentType.RIGHT, after: 200 })
  );
  children.push(emptyLine(200));
  children.push(
    para([text('Signature', { size: SIZE_NORMAL })], { alignment: AlignmentType.RIGHT, after: 40 })
  );
  children.push(
    para([text('(titulaire du marché public)', { italics: true, size: SIZE_SMALL })], { alignment: AlignmentType.RIGHT, after: 200 })
  );

  // ── FOOTER ────────────────────────────────────────────────────────────────
  children.push(emptyLine(200));
  children.push(
    para([text('Date de mise à jour : 01/04/2019.', { size: 16 })], { after: 40 })
  );

  // ── CONSTRUCTION DU DOCUMENT ──────────────────────────────────────────────
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 720, bottom: 720, left: 1080, right: 1080 },
        },
      },
      children,
    }],
  });

  return doc;
};

// ─── EXPORT DOCX ────────────────────────────────────────────────────────────
export const exportExe1Docx = async (fiche, exe1Data) => {
  const doc = await generateExe1Document(fiche, exe1Data);
  const blob = await Packer.toBlob(doc);
  const filename = `EXE1-T_${(fiche.nom || 'ordre-service').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.docx`;
  saveAs(blob, filename);
};

// ─── EXPORT PDF (jsPDF + autoTable) ─────────────────────────────────────────

// Formater un nombre pour PDF (évite les caractères spéciaux type espace insécable)
const formatNumber = (num) => {
  if (!num && num !== 0) return '';
  const n = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(n)) return '';
  // Formatage manuel : séparateur milliers = espace normal, décimales = virgule
  const parts = n.toFixed(2).split('.');
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${intPart},${parts[1]}`;
};

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

export const exportExe1Pdf = async (fiche, exe1Data) => {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const A = fiche.sectionA || {};
  const B = fiche.sectionB || {};
  const C = fiche.sectionC || {};
  const D = fiche.sectionD || {};

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const marginL = 20;
  const marginR = 20;
  const contentW = pageW - marginL - marginR;
  let y = 18;

  // ── Helpers PDF ───────────────────────────────────────────────────────────
  const BG_COLOR = [176, 224, 242]; // Bleu cyan #B0E0F2 (style DAJ)
  const BLACK = [0, 0, 0];
  const FONT_NORMAL = 10;
  const FONT_SMALL = 9;
  const FONT_TITLE = 11;
  const LINE_H = 4.5;

  const checkPage = (needed = 20) => {
    if (y + needed > pageH - 20) {
      pdf.addPage();
      y = 18;
    }
  };

  // Dessiner un titre de section (barre cyan sans bordure — style DAJ)
  const drawSectionTitle = (letter, title) => {
    const fullText = `${letter} - ${title}`;
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(FONT_TITLE);
    const lines = pdf.splitTextToSize(fullText, contentW - 6);
    const boxH = Math.max(8, lines.length * 5 + 3);
    checkPage(boxH + 6);
    pdf.setFillColor(...BG_COLOR);
    pdf.rect(marginL, y, contentW, boxH, 'F');
    pdf.setTextColor(...BLACK);
    lines.forEach((line, i) => { pdf.text(line, marginL + 3, y + 5 + i * 5); });
    y += boxH + 4;
  };

  // Écrire du texte avec word-wrap automatique
  const writeText = (content, opts = {}) => {
    const size = opts.size || FONT_NORMAL;
    const style = opts.bold ? 'bold' : opts.italics ? 'italic' : 'normal';
    const align = opts.align || 'left';
    pdf.setFont('helvetica', style);
    pdf.setFontSize(size);
    pdf.setTextColor(...BLACK);

    const indent = opts.indentLeft || 0;
    const maxW = contentW - indent;
    const lines = pdf.splitTextToSize(content, maxW);

    lines.forEach((line) => {
      checkPage(LINE_H + 2);
      const xPos = align === 'right'
        ? pageW - marginR
        : marginL + indent;
      pdf.text(line, xPos, y, { align });
      y += LINE_H;
    });
    y += (opts.after || 1);
  };

  // Écrire une ligne avec puce carrée dessinée manuellement
  const writeBulletText = (content, opts = {}) => {
    const size = opts.size || FONT_NORMAL;
    const style = opts.bold ? 'bold' : opts.italics ? 'italic' : 'normal';
    pdf.setFont('helvetica', style);
    pdf.setFontSize(size);
    pdf.setTextColor(...BLACK);

    // Dessiner un petit carré noir comme puce
    checkPage(LINE_H + 2);
    const bulletSize = 1.8;
    const bulletY = y - bulletSize + 0.3;
    pdf.setFillColor(...BLACK);
    pdf.rect(marginL, bulletY, bulletSize, bulletSize, 'F');

    // Texte après la puce
    const indent = 6;
    const maxW = contentW - indent;
    const lines = pdf.splitTextToSize(content, maxW);

    lines.forEach((line, i) => {
      checkPage(LINE_H + 2);
      pdf.text(line, marginL + indent, y);
      y += LINE_H;
    });
    y += (opts.after || 1);
  };

  // Écrire les infos d'une entreprise
  const writeEntreprise = (ent) => {
    if (!ent) { writeText(dots(60)); return; }
    const parts = [];
    if (ent.nomCommercial) parts.push(ent.nomCommercial);
    if (ent.denominationSociale) parts.push(`(${ent.denominationSociale})`);
    if (ent.adresse) parts.push(ent.adresse);
    if (ent.codePostal || ent.ville) parts.push(`${ent.codePostal || ''}  ${ent.ville || ''}`.trim());
    if (ent.email) parts.push(`Email : ${ent.email}`);
    if (ent.telephone) parts.push(`Tel. : ${ent.telephone}`);
    if (ent.telecopie) parts.push(`Fax : ${ent.telecopie}`);
    if (ent.siret) parts.push(`SIRET : ${ent.siret}`);
    parts.forEach((p) => writeText(p, { size: FONT_NORMAL, after: 0 }));
    y += 2;
  };

  // ══════════════════════════════════════════════════════════════════════════
  // ── EN-TÊTE (style DAJ — logo Marianne + rectangle cyan) ─────────────────
  // ══════════════════════════════════════════════════════════════════════════
  const MARIANNE_B64 = await loadMarianneImage();
  const osTypeLabel = OS_TYPE_LABELS_PDF[exe1Data.typeOS] || OS_TYPE_LABELS_PDF.demarrage;
  const osNum = exe1Data.numeroOrdreService || dots(15);

  if (MARIANNE_B64 && MARIANNE_B64.length > 10) {
    const logoW = 35, logoH = 20;
    const logoX = (pageW - logoW) / 2;
    try { pdf.addImage(MARIANNE_B64, 'JPEG', logoX, y, logoW, logoH); } catch { /* skip */ }
    y += logoH + 5;
  }

  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(FONT_NORMAL);
  pdf.text("MINISTÈRE DE L'ÉCONOMIE ET DES FINANCES", pageW / 2, y, { align: 'center' });
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(FONT_SMALL);
  pdf.text('Direction des Affaires Juridiques', pageW / 2, y + 5, { align: 'center' });
  y += 12;

  const boxTitleY = y;
  const boxTitleH = 30;
  pdf.setFillColor(...BG_COLOR);
  pdf.rect(marginL, boxTitleY, contentW, boxTitleH, 'F');

  pdf.setTextColor(...BLACK);
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(14);
  pdf.text('MARCHÉS PUBLICS ET ACCORDS-CADRES', pageW / 2, boxTitleY + 7, { align: 'center' });
  pdf.setFontSize(FONT_TITLE);
  pdf.text('MARCHÉS DE TRAVAUX', pageW / 2, boxTitleY + 13, { align: 'center' });
  pdf.setFontSize(13);
  pdf.text(`ORDRE DE SERVICE N\u00B0 ${osNum}`, pageW / 2, boxTitleY + 20, { align: 'center' });
  pdf.setFontSize(FONT_NORMAL); pdf.setFont('helvetica', 'normal');
  pdf.text(osTypeLabel, pageW / 2, boxTitleY + 26, { align: 'center' });
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(22);
  pdf.text('EXE1-T', pageW - marginR - 5, boxTitleY + 17, { align: 'right' });

  y = boxTitleY + boxTitleH + 10;

  // ══════════════════════════════════════════════════════════════════════════
  // ── SECTION A ─────────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  drawSectionTitle('A', "Identification du pouvoir adjudicateur ou de l'entité adjudicatrice");

  const aLines = [
    A.designation, A.adresse,
    [A.codePostal, A.ville].filter(Boolean).join('  '),
    A.telephone ? `Tél. : ${A.telephone}` : '',
    A.email ? `Email : ${A.email}` : '',
    A.representant ? `Représentant : ${A.representant}${A.qualite ? ` (${A.qualite})` : ''}` : '',
  ].filter(Boolean);
  aLines.forEach((l) => writeText(l, { after: 0 }));
  y += 10;

  // ══════════════════════════════════════════════════════════════════════════
  // ── SECTION B ─────────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  drawSectionTitle('B', 'Identification du titulaire du marché public');

  if (B.type === 'groupement') {
    writeText(`Groupement ${B.typeGroupement || 'solidaire'} :`, { bold: true, after: 2 });
    writeText('Mandataire :', { bold: true, size: FONT_SMALL, after: 1 });
    writeEntreprise(B.mandataire);
    y += 1;
    (B.cotraitants || []).forEach((cot, i) => {
      writeText(`Co-traitant ${i + 1} :`, { bold: true, size: FONT_SMALL, after: 1 });
      writeEntreprise(cot);
      y += 1;
    });
  } else {
    writeEntreprise(B.mandataire);
  }
  y += 10;

  // ══════════════════════════════════════════════════════════════════════════
  // ── SECTION C ─────────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  drawSectionTitle('C', "Identification du maître d'œuvre");
  writeEntreprise(C);
  y += 10;

  // ══════════════════════════════════════════════════════════════════════════
  // ── SECTION D ─────────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  drawSectionTitle('D', 'Objet du marché public');

  if (D.objet) writeText(D.objet, { after: 2 });
  if (D.lots && D.lots.length > 0) {
    D.lots.forEach((lot) => {
      writeText(`Lot ${lot.numero || '?'} : ${lot.designation || ''}`, { after: 0 });
    });
    y += 2;
  }

  writeBulletText(`Référence du marché public : ${D.referenceMarche || dots(40)}`, { after: 2 });
  writeBulletText(`Date de la notification du marché public : ${formatDate(D.dateNotification)}`, { after: 2 });
  const dureePrepa = D.dureePeriodePreparation ? `${D.dureePeriodePreparation} mois` : null;
  const dureeTravaux = D.dureeExecution ? `${D.dureeExecution} mois` : null;
  const dureeTotal = (parseFloat(D.dureePeriodePreparation) || 0) + (parseFloat(D.dureeExecution) || 0);
  writeBulletText(`Durée d'exécution du marché public : ${dureeTotal || dots(10)} mois${dureePrepa ? ` (dont ${dureePrepa} de préparation + ${dureeTravaux || dots(5)} de travaux)` : ''}.`, { after: 2 });
  const labelDateDemarrage = exe1Data.typeOS === 'preparation'
    ? 'Date de démarrage de la période de préparation'
    : 'Date de démarrage des travaux';
  writeBulletText(`${labelDateDemarrage} : ${formatDate(exe1Data.dateDemarragePrestations)}`, { bold: true, after: 10 });

  // ══════════════════════════════════════════════════════════════════════════
  // ── SECTION E ─────────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  drawSectionTitle('E', 'Prestations ordonnées');

  writeBulletText("Adresse d'exécution des prestations ordonnées :", { after: 1 });
  writeText(exe1Data.adresseExecution || D.adresseExecution || dots(60), { indentLeft: 6, after: 3 });

  // Délai auto-rempli selon le type d'OS si non saisi manuellement
  const delaiAuto = exe1Data.delaiExecution
    || (exe1Data.typeOS === 'preparation' && D.dureePeriodePreparation ? `${D.dureePeriodePreparation} mois` : '')
    || (exe1Data.typeOS === 'demarrage' && D.dureeExecution ? `${D.dureeExecution} mois` : '');
  writeBulletText(`Délai d'exécution des prestations ordonnées : ${delaiAuto || dots(40)}`, { after: 3 });

  writeBulletText('Autres précisions :', { after: 1 });
  if (exe1Data.autresPrecisions) {
    writeText(exe1Data.autresPrecisions, { size: FONT_SMALL, indentLeft: 6, after: 4 });
  } else {
    y += 4;
  }

  // Tableau des prestations — si vide, pré-remplir avec les lots
  const tableHead = [['Désignation des prestations ordonnées', 'Quantité', 'TVA', 'Prix unitaire HT', 'Montant HT']];
  let totalHT = 0;
  let totalTVA = 0;

  let prestations = (exe1Data.prestations || []).filter((p) => p.designation || p.quantite || p.prixUnitaire);

  // Si aucune prestation saisie, reprendre les lots comme prestations
  if (prestations.length === 0 && D.lots && D.lots.length > 0) {
    prestations = D.lots.map((lot) => {
      const raw = (lot.montantHT || '').replace(/\s/g, '').replace(',', '.');
      return {
        designation: `Lot ${lot.numero || '?'} : ${lot.designation || ''}`.trim(),
        quantite: '1',
        tva: '20',
        prixUnitaire: raw && !isNaN(parseFloat(raw)) ? parseFloat(raw).toFixed(2) : '',
      };
    });
  }

  const tableBody = prestations.map((p) => {
      const q = parseFloat(p.quantite) || 0;
      const pu = parseFloat(p.prixUnitaire) || 0;
      const tvaRate = parseFloat(p.tva) || 0;
      const montantHT = q * pu;
      const montantTVA = montantHT * tvaRate / 100;
      totalHT += montantHT;
      totalTVA += montantTVA;
      return [
        p.designation || '',
        p.quantite || '',
        tvaRate > 0 ? `${p.tva} %` : '',
        pu > 0 ? `${formatNumber(pu)} \u20AC` : '',
        montantHT > 0 ? `${formatNumber(montantHT)} \u20AC` : '',
      ];
    });

  if (tableBody.length === 0) {
    tableBody.push(['', '', '', '', '']);
  }

  const totalTTC = totalHT + totalTVA;

  checkPage(30);
  autoTable(pdf, {
    startY: y,
    head: tableHead,
    body: tableBody,
    margin: { left: marginL, right: marginR },
    styles: {
      font: 'helvetica',
      fontSize: FONT_SMALL,
      cellPadding: 2.5,
      lineColor: BLACK,
      lineWidth: 0.3,
      textColor: BLACK,
    },
    headStyles: {
      fillColor: BG_COLOR,
      textColor: BLACK,
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 'auto', halign: 'left' },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 16, halign: 'center' },
      3: { cellWidth: 30, halign: 'right' },
      4: { cellWidth: 30, halign: 'right' },
    },
    theme: 'grid',
  });

  // Lignes récapitulatives HT / TVA / TTC
  const summaryStartY = pdf.lastAutoTable.finalY;
  const summaryColX = marginL + contentW - 60;  // aligné sur les 2 dernières colonnes
  const summaryValX = marginL + contentW;

  autoTable(pdf, {
    startY: summaryStartY,
    body: [
      [{ content: 'Total HT', styles: { fontStyle: 'bold', halign: 'right' } }, `${formatNumber(totalHT)} \u20AC`],
      [{ content: 'TVA', styles: { fontStyle: 'bold', halign: 'right' } }, `${formatNumber(totalTVA)} \u20AC`],
      [{ content: 'Total TTC', styles: { fontStyle: 'bold', halign: 'right' } }, `${formatNumber(totalTTC)} \u20AC`],
    ],
    margin: { left: marginL + contentW - 60, right: marginR },
    styles: {
      font: 'helvetica',
      fontSize: FONT_SMALL,
      cellPadding: 2.5,
      lineColor: BLACK,
      lineWidth: 0.3,
      textColor: BLACK,
    },
    columnStyles: {
      0: { cellWidth: 30, halign: 'right' },
      1: { cellWidth: 30, halign: 'right' },
    },
    theme: 'grid',
  });

  y = pdf.lastAutoTable.finalY + 4;

  // ══════════════════════════════════════════════════════════════════════════
  // ── SECTION F — Signature MOE ─────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  checkPage(50);
  drawSectionTitle('F', "Signature du maître d'œuvre");
  y += 5;
  writeText(
    `À ${exe1Data.lieuSignatureMoe || dots(25)}, le ${formatDate(exe1Data.dateSignatureMoe)}`,
    { align: 'right', after: 18 }
  );
  writeText('Signature', { align: 'right', after: 1 });
  writeText("(maître d'œuvre)", { align: 'right', italics: true, size: FONT_SMALL, after: 2 });

  // Image signature/tampon MOE
  const moeSig1 = await loadMoeSignatureWithDimensions();
  if (moeSig1) {
    const sigMaxW = 45, sigMaxH = 25;
    const sigRatio = Math.min(sigMaxW / moeSig1.width, sigMaxH / moeSig1.height, 1);
    const sigW = moeSig1.width * sigRatio;
    const sigH = moeSig1.height * sigRatio;
    checkPage(sigH + 8);
    try { pdf.addImage(moeSig1.dataUrl, 'JPEG', pageW - marginR - sigW, y, sigW, sigH); } catch { /* skip */ }
    y += sigH + 4;
  } else {
    y += 10;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── SECTION G — Accusé de réception ───────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  checkPage(60);
  drawSectionTitle('G', "Accusé de réception de l'ordre de service, par le titulaire du marché public");
  y += 3;
  writeText(`Reçu le présent ordre de service le ${formatDate(exe1Data.dateReception)}`, { after: 3 });
  writeText('Observations éventuelles :', { after: 1 });
  if (exe1Data.observations) {
    writeText(exe1Data.observations, { size: FONT_SMALL, indentLeft: 6, after: 6 });
  } else {
    y += 6;
  }
  writeText(
    `A ${exe1Data.lieuSignatureTitulaire || dots(25)}, le ${formatDate(exe1Data.dateSignatureTitulaire)}`,
    { align: 'right', after: 18 }
  );
  writeText('Signature', { align: 'right', after: 1 });
  writeText('(titulaire du marché public)', { align: 'right', italics: true, size: FONT_SMALL, after: 8 });

  // ── FOOTER ────────────────────────────────────────────────────────────────
  y += 4;
  writeText('Date de mise à jour : 01/04/2019.', { size: 8, after: 0 });

  // ── SAUVEGARDE ────────────────────────────────────────────────────────────
  const filename = `EXE1-T_${(fiche.nom || 'ordre-service').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
  pdf.save(filename);
  return 'pdf';
};
