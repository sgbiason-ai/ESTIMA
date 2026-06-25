// src/utils/tp/tpPdfExport.js
// ESTIMA TP — exports PDF (deux fonctions distinctes, bouton dédié chacune) :
//   • generateTpBordereauPdf : bordereau chiffré (DQE récap, portrait A4)
//   • generateTpSousDetailPdf : sous-détails de prix (matrice SPIE, paysage A4)
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { buildRefMap } from '../projectCalculations';
import { saveFileWithPicker, FILE_TYPES, PICKER_IDS } from '../fileSaver';
import {
  computeDetail, defaultCoefficients, DEFAULT_COEF, POSTES, effectiveRendement, detailCalcQty,
  ressourceCosts, ressourceDailyCost, fournitureQty, fournitureCost,
  sousTraitanceCost, sousTraitanceQty, lineDuree, transportCost, transportCamions,
  num, r2,
} from './tpPriceCompute';

// ─── Couleurs (RGB) — postes alignés sur l'UI ────────────────────────────────
const C = {
  text:    [17, 24, 39],
  subtle:  [107, 114, 128],
  gray:    [243, 244, 246],
  border:  [203, 213, 225],
  orange:  [234, 88, 12],
  blue:    [37, 99, 235],
  emerald: [5, 150, 105],
  violet:  [124, 58, 237],
  amber:   [217, 119, 6],
  bandeau: [255, 247, 237],
};

// Couleur par poste (en-tête de groupe de colonnes)
const POSTE_COLOR = {
  materiel: C.orange, mo: C.blue, fourniture: C.emerald, soustraitance: C.violet, transport: C.amber,
};

// Remplace TOUT espace blanc (regular U+0020, NARROW NO-BREAK U+202F que toLocaleString
// fr-FR injecte parfois, etc.) par NBSP U+00A0 → autoTable ne peut plus couper le nombre
// à la place du séparateur de milliers (bug « 1 / 008,00 € » sur les colonnes étroites).
const NBSP = '\u00A0';
const nbsp = (s) => String(s).replace(/\s/g, NBSP);
const fr2 = (n) => nbsp(Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const fr3 = (n) => nbsp(Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }));
const e2 = (n) => `${fr2(n)}${NBSP}€`;
const eEmpty = (n) => (Number(n || 0) > 0 ? fr2(n) : '');

// Charge le branding société (logo + adresse) — fallback null si absent ou hors-ligne.
async function loadBranding(companyId) {
  if (!companyId) return null;
  try {
    const [{ getDoc, doc }, { db }] = await Promise.all([
      import('firebase/firestore'),
      import('../../firebase'),
    ]);
    const snap = await getDoc(doc(db, 'companies', companyId, 'resources', 'branding'));
    if (!snap.exists()) return null;
    const data = snap.data();
    return data?.config || data || null;
  } catch (e) {
    console.warn('[tpPdfExport] branding non chargé :', e?.message);
    return null;
  }
}

// Devine le format d'une dataURL (PNG par défaut, JPEG si data:image/jpe?g).
function imageFormat(dataUrl) {
  if (typeof dataUrl !== 'string') return 'PNG';
  if (/^data:image\/jpe?g/i.test(dataUrl)) return 'JPEG';
  return 'PNG';
}

function collectArticles(chapters) {
  const refMap = buildRefMap(chapters || [], { numberingMode: 'hierarchical' });
  const arts = [];
  const walk = (nodes) => (nodes || []).forEach(n => {
    if (!n) return;
    if (n.type === 'item') arts.push({ node: n, num: refMap.get(n.id) || '' });
    if (n.children) walk(n.children);
  });
  walk(chapters);
  return arts;
}

// ─── En-tête de page (logo + agence | titre + objet | n° page) ───────────────
function drawHeader(doc, { branding, study, art, pageNum }) {
  const W = doc.internal.pageSize.getWidth();
  const margin = 8;

  // Logo (carré ~22mm) si dispo
  let xText = margin;
  if (branding?.logo) {
    try {
      doc.addImage(branding.logo, imageFormat(branding.logo), margin, 6, 22, 22, undefined, 'FAST');
      xText = margin + 25;
    } catch { /* image invalide → on continue sans */ }
  }

  // Bloc entreprise (gauche)
  doc.setTextColor(...C.text);
  doc.setFont(undefined, 'bold'); doc.setFontSize(11);
  doc.text(branding?.companyName || study?.companyName || '', xText, 10);
  doc.setFont(undefined, 'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.subtle);
  const lines = [
    branding?.tagline,
    branding?.address,
    [branding?.zip, branding?.city].filter(Boolean).join(' '),
    branding?.phone && `Tél : ${branding.phone}`,
    branding?.email && `E-mail : ${branding.email}`,
  ].filter(Boolean);
  let yy = 14;
  lines.forEach(l => { doc.text(String(l), xText, yy); yy += 3.2; });

  // Bloc titre (centre)
  const titleX = W / 2;
  doc.setDrawColor(...C.text); doc.setLineWidth(0.5);
  doc.roundedRect(titleX - 40, 7, 80, 9, 1, 1, 'S');
  doc.setFont(undefined, 'bold'); doc.setFontSize(13); doc.setTextColor(...C.text);
  doc.text('SOUS DÉTAIL DE PRIX', titleX, 13, { align: 'center' });

  // Objet + n° prix + désignation (droite-centre)
  doc.setFont(undefined, 'normal'); doc.setFontSize(8.5); doc.setTextColor(...C.subtle);
  doc.text('Objet des travaux :', titleX - 40, 20);
  doc.setTextColor(...C.text); doc.setFont(undefined, 'bold');
  doc.text(study?.name || '', titleX - 10, 20);

  if (art) {
    // N° prix encadré + désignation encadrée
    doc.setDrawColor(...C.border); doc.setLineWidth(0.3);
    doc.roundedRect(titleX - 40, 23, 36, 7, 0.8, 0.8, 'S');
    doc.setFont(undefined, 'normal'); doc.setTextColor(...C.subtle); doc.setFontSize(8);
    doc.text('Prix n° :', titleX - 38, 27.5);
    doc.setFont(undefined, 'bold'); doc.setTextColor(...C.orange); doc.setFontSize(9);
    doc.text(String(art.num || ''), titleX - 24, 27.5);

    doc.setDrawColor(...C.border);
    doc.roundedRect(titleX - 2, 23, W / 2 - 12, 7, 0.8, 0.8, 'S');
    doc.setFont(undefined, 'bold'); doc.setTextColor(...C.text); doc.setFontSize(9);
    const desig = art.node?.designation || '';
    doc.text(desig.length > 70 ? desig.slice(0, 67) + '…' : desig, titleX, 27.5);
  }

  // N° page (haut droit)
  doc.setFont(undefined, 'normal'); doc.setFontSize(8); doc.setTextColor(...C.subtle);
  doc.text(String(pageNum), W - margin, 10, { align: 'right' });
}

// ─── Bandeau Quantité (+ Qté de calcul) + Rendement + Durée (sous l'en-tête) ──
// Segments répartis uniformément : 3 par défaut, 4 si une quantité de calcul est saisie
// (ex. décapage au m² piloté en m³). Le rendement s'exprime alors dans l'unité de calcul.
function drawBandeau(doc, { qte, unit, calcQte, calcUnit, hasCalc, rdt, duree }) {
  const W = doc.internal.pageSize.getWidth();
  const margin = 8;
  const y = 34;
  const h = 6.5;
  doc.setFillColor(...C.bandeau); doc.setDrawColor(...C.orange); doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, W - 2 * margin, h, 1, 1, 'FD');
  const segs = [
    ['Quantité estimée', `${fr2(qte)} ${unit || ''}`],
    ...(hasCalc ? [['Qté de calcul', `${fr2(calcQte)} ${calcUnit || ''}`]] : []),
    ['Rendement', hasCalc ? `${fr2(rdt)} ${calcUnit || ''}/j` : `${fr2(rdt)}/j`],
    ['Durée', `${fr2(duree)} j`],
  ];
  const step = (W - 2 * margin - 6) / segs.length;
  doc.setFontSize(9);
  segs.forEach(([label, val], i) => {
    const x = margin + 3 + i * step;
    doc.setFont(undefined, 'normal'); doc.setTextColor(...C.subtle);
    doc.text(`${label} :`, x, y + 4.5);
    const lw = doc.getTextWidth(`${label} :`) + 2;
    doc.setFont(undefined, 'bold'); doc.setTextColor(...C.text);
    doc.text(String(val), x + lw, y + 4.5);
  });
}

// ─── Matrice SPIE : head 2 niveaux + lignes ressources + totaux + synthèse ───
//
// 16 colonnes : 3 (Eléments) + 2 (Personnel) + 5 (Matériel) + 2 (Fourn) + 2 (ST) + 2 (Transport)
// Largeurs colonnes (mm) — 281mm utiles (paysage A4 − marges). HARMONISÉES :
//   • toutes les colonnes « PU / Coût Unit. » = 13mm (cols 3, 8, 10, 12, 14)
//   • toutes les colonnes « Total » de poste   = 25mm (cols 4, 9, 11, 13, 15) — larges
//   • Amort. / Entret. / Cons.                  = 11mm (cols 5, 6, 7)
//   Σ = 36+7+15 + (13+25) + (11+11+11+13+25) + (13+25) + (13+25) + (13+25) = 281mm
const COL_W = [36, 7, 15, 13, 25, 11, 11, 11, 13, 25, 13, 25, 13, 25, 13, 25]; // = 281mm
const N = 16;

const empty = () => Array(N).fill('');

// Construit la ligne pour une ressource selon son poste.
function rowForLine(line, posteKey, qte, duree) {
  const row = empty();
  const desig = line.designation || '';
  row[0] = desig;
  switch (posteKey) {
    case 'materiel': {
      // Format SPIE : PU/Coût Unit/Amort/Entret/Cons/Loc SANS « € » (densité, alignement
      // parfait sur les décimales) ; les Totaux AVEC « € ».
      const dur = lineDuree(line, duree);
      const nb = num(line.nombre);
      const perso = num(line.puJour);
      const matDaily = num(line.amort) + num(line.entret) + num(line.cons) + num(line.loc);
      row[1] = 'J';
      row[2] = fr2(nb * dur);
      row[3] = perso > 0 ? fr2(perso) : '';
      row[4] = perso > 0 ? e2(perso * nb * dur) : '';
      row[5] = eEmpty(line.amort);
      row[6] = eEmpty(line.entret);
      row[7] = eEmpty(line.cons);
      row[8] = eEmpty(line.loc);
      row[9] = matDaily > 0 ? e2(matDaily * nb * dur) : '';
      return row;
    }
    case 'mo': {
      const dur = lineDuree(line, duree);
      const nb = num(line.nombre);
      row[1] = 'J';
      row[2] = fr2(nb * dur);
      row[3] = fr2(ressourceDailyCost(line));
      row[4] = e2(ressourceCosts(line, duree));
      return row;
    }
    case 'fourniture': {
      const q = fournitureQty(line, qte);
      row[1] = line.unit || '';
      row[2] = fr2(q);
      const pu = Number(line.puForce) > 0 ? line.puForce : line.puBareme;
      row[10] = fr2(pu);
      row[11] = e2(fournitureCost(line, qte));
      return row;
    }
    case 'soustraitance': {
      const q = sousTraitanceQty(line, qte);
      row[1] = line.unit || '';
      row[2] = fr2(q);
      const pu = Number(line.puForce) > 0 ? line.puForce : line.puBareme;
      row[12] = fr2(pu);
      row[13] = e2(sousTraitanceCost(line, qte));
      return row;
    }
    case 'transport': {
      row[1] = line.unit || '';
      row[2] = `${fr2(transportCamions(line, qte, duree))} cam.`;
      row[14] = fr2(line.coutJour);
      row[15] = e2(transportCost(line, qte));
      return row;
    }
    default: return row;
  }
}

// Style cellule centré uppercase pour les en-têtes de groupe (1ʳᵉ ligne du head).
const groupStyle = (bg) => ({
  fillColor: bg, textColor: 255, fontStyle: 'bold', fontSize: 9, halign: 'center', valign: 'middle',
});

// qteLines : quantité qui pilote les lignes (qté de calcul si saisie, sinon cadre).
// qteCadre : quantité du bordereau → division pour ramener un total au PU unitaire.
function drawMatrix(doc, { d, qteLines, qteCadre, duree, sec, puSecGlobal, puVenteGlobal, coef, unit }) {
  const cf = (p) => (coef?.[p] ?? DEFAULT_COEF);      // même fallback que computeDetail
  const div = (n) => (qteCadre > 0 ? n / qteCadre : 0); // ramène un total à l'unité du cadre

  // Totaux SPIE calculés PAR LIGNE (mêmes valeurs arrondies que les lignes affichées) →
  // garantit « Σ lignes = Total » au centime. Le « chauffeur » (puJour d'un matériel) est
  // compté en Personnel, le reste (amort/entret/cons/loc) en Matériel. num() = source unique
  // (nb=0/vide reste 0, comme ressourceCosts), pas de ligne fantôme.
  let chauffeurPart = 0; // Σ coût chauffeur (déboursé sec) — déplacé en Personnel
  let materielDisp = 0;  // Σ coût matériel hors chauffeur
  (d?.materiel || []).forEach(line => {
    const nb = num(line.nombre);
    const dur = lineDuree(line, duree);
    const matDaily = num(line.amort) + num(line.entret) + num(line.cons) + num(line.loc);
    chauffeurPart += r2(num(line.puJour) * nb * dur);
    materielDisp += r2(matDaily * nb * dur);
  });
  const moDisp = (d?.mo || []).reduce((s, line) => s + ressourceCosts(line, duree), 0);

  // Totaux affichés par colonne. Invariant : Σ totalDisp ≈ déboursé sec.
  const totalDisp = {
    mo:            r2(moDisp + chauffeurPart),
    materiel:      r2(materielDisp),
    fourniture:    sec.fourniture,
    soustraitance: sec.soustraitance,
    transport:     sec.transport,
  };
  // PV affichés par colonne — le chauffeur conserve le coef matériel (sa source), MO le sien.
  const pvDisp = {
    mo:            r2(moDisp * cf('mo') + chauffeurPart * cf('materiel')),
    materiel:      r2(materielDisp * cf('materiel')),
    fourniture:    r2(sec.fourniture * cf('fourniture')),
    soustraitance: r2(sec.soustraitance * cf('soustraitance')),
    transport:     r2(sec.transport * cf('transport')),
  };
  // PU calculé global = Σ PV / quantité (cohérent avec les colonnes ci-dessus).
  const puCalcLocal = div(pvDisp.mo + pvDisp.materiel + pvDisp.fourniture + pvDisp.soustraitance + pvDisp.transport);

  // ── Head : 2 lignes (groupes + sous-colonnes) ──
  const head = [
    [
      { content: 'Éléments constitutifs', colSpan: 3, styles: groupStyle([100, 116, 139]) },
      { content: 'Personnel',              colSpan: 2, styles: groupStyle(C.blue) },
      { content: 'Matériel',               colSpan: 5, styles: groupStyle(C.orange) },
      { content: 'Fournitures',            colSpan: 2, styles: groupStyle(C.emerald) },
      { content: 'Sous-traitance',         colSpan: 2, styles: groupStyle(C.violet) },
      { content: 'Transport',              colSpan: 2, styles: groupStyle(C.amber) },
    ],
    [
      'Désignation', 'U', 'Quantité ou Durée',
      'Coût Unit.', 'Total',
      'Amort.', 'Entret.', 'Cons.', 'PU', 'Montant Total',
      'PU', 'Total',
      'PU', 'Total',
      'PU', 'Total',
    ],
  ];

  // ── Body : ressources, regroupées par poste dans l'ordre POSTES ──
  const body = [];
  POSTES.forEach(p => {
    const lines = d?.[p] || [];
    lines.forEach(l => body.push(rowForLine(l, p, qteLines, duree)));
  });

  // Ligne « Total » par poste (sur les colonnes Total des groupes, avec split chauffeur)
  const totalRow = empty();
  totalRow[2] = { content: 'Total', styles: { halign: 'right', fontStyle: 'bold', fillColor: C.gray } };
  totalRow[4]  = { content: e2(totalDisp.mo),            styles: { halign: 'right', fontStyle: 'bold', fillColor: C.gray, textColor: C.blue } };
  totalRow[9]  = { content: e2(totalDisp.materiel),      styles: { halign: 'right', fontStyle: 'bold', fillColor: C.gray, textColor: C.orange } };
  totalRow[11] = { content: e2(totalDisp.fourniture),    styles: { halign: 'right', fontStyle: 'bold', fillColor: C.gray, textColor: C.emerald } };
  totalRow[13] = { content: e2(totalDisp.soustraitance), styles: { halign: 'right', fontStyle: 'bold', fillColor: C.gray, textColor: C.violet } };
  totalRow[15] = { content: e2(totalDisp.transport),     styles: { halign: 'right', fontStyle: 'bold', fillColor: C.gray, textColor: C.amber } };
  body.push(totalRow);

  // ── Synthèse : PU sec, coef, PU calculé, PU vente — alignée sur les colonnes ──
  // Lignes synthèse : label en colSpan 2 (cols 0-1 = 43mm, large pour textes longs) et
  // valeur globale en colSpan 2 (cols 2-3 = 28mm, suffit pour « 15 605,50 € ») → plus de
  // wrap du grand montant dans une cellule de 15mm. Valeurs par poste : cols 4, 9, 11, 13, 15.
  const synthRow = (label, valGlobal, valByPoste, opts = {}) => {
    const right = (v, extra = {}) => ({ content: v, styles: { halign: 'right', fontStyle: 'bold', ...extra } });
    return [
      // col 0-1 : label (colSpan 2)
      { content: label, colSpan: 2, styles: { fontStyle: 'bold', fillColor: opts.bgLabel || [255, 255, 255], textColor: opts.tcLabel || C.text } },
      // col 2-3 : valeur globale (colSpan 2)
      { content: valGlobal, colSpan: 2, styles: { halign: 'right', fontStyle: 'bold', fillColor: opts.bg || [255, 255, 255], textColor: opts.tc || C.text } },
      // col 4 : Pers Total
      valByPoste ? right(valByPoste.mo) : '',
      // cols 5-8 : Amort, Entret, Cons, PU Mat (vides en synthèse)
      '', '', '', '',
      // col 9 : Mat Total
      valByPoste ? right(valByPoste.materiel) : '',
      // col 10 : Fourn PU (vide)
      '',
      // col 11 : Fourn Total
      valByPoste ? right(valByPoste.fourniture) : '',
      // col 12 : ST PU (vide)
      '',
      // col 13 : ST Total
      valByPoste ? right(valByPoste.soustraitance) : '',
      // col 14 : Trans PU (vide)
      '',
      // col 15 : Trans Total
      valByPoste ? right(valByPoste.transport) : '',
    ];
  };

  body.push(synthRow('Prix Unitaire Sec', e2(puSecGlobal), {
    mo: e2(div(totalDisp.mo)),
    materiel: e2(div(totalDisp.materiel)),
    fourniture: e2(div(totalDisp.fourniture)),
    soustraitance: e2(div(totalDisp.soustraitance)),
    transport: e2(div(totalDisp.transport)),
  }));
  body.push(synthRow('Coef. frais généraux / Bénéfices et aléas', '', {
    mo: fr3(cf('mo')), materiel: fr3(cf('materiel')), fourniture: fr3(cf('fourniture')),
    soustraitance: fr3(cf('soustraitance')), transport: fr3(cf('transport')),
  }));
  body.push(synthRow('Prix Unitaire Calculé', e2(puCalcLocal), {
    mo: e2(div(pvDisp.mo)),
    materiel: e2(div(pvDisp.materiel)),
    fourniture: e2(div(pvDisp.fourniture)),
    soustraitance: e2(div(pvDisp.soustraitance)),
    transport: e2(div(pvDisp.transport)),
  }, { bg: [254, 243, 199] }));
  body.push(synthRow(`Prix Unitaire de Vente${unit ? ' /' + unit : ''}`, e2(puVenteGlobal), null, {
    bg: C.orange, tc: 255, bgLabel: C.orange, tcLabel: 255,
  }));

  // Col 0 (Désignation) : retour à la ligne sur les libellés longs (linebreak).
  // Colonnes numériques : overflow 'visible' → un montant exceptionnellement large déborde
  // proprement sur le côté au lieu d'être éclaté caractère par caractère (le NBSP de fr2()
  // empêche déjà la coupure au séparateur de milliers ; ceci couvre le cas montant > largeur).
  const columnStyles = {};
  COL_W.forEach((w, i) => {
    columnStyles[i] = {
      cellWidth: w,
      overflow: i === 0 ? 'linebreak' : 'visible',
      halign: i === 0 ? 'left' : (i === 1 ? 'center' : 'right'),
    };
  });

  autoTable(doc, {
    startY: 42,
    head, body,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1, lineColor: C.border, lineWidth: 0.15, textColor: C.text, overflow: 'linebreak' },
    headStyles: { fontSize: 7, fontStyle: 'bold', textColor: C.text, fillColor: [248, 250, 252] },
    bodyStyles: { fontSize: 7 },
    columnStyles,
    margin: { left: 8, right: 8 },
  });
}

// ─── Pied de page « Établi par … » ───────────────────────────────────────────
function drawFooter(doc, { branding }) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const established = `Établi par ${branding?.companyName || ''}${branding?.city ? ' à ' + branding.city : ''}  le ${new Date().toLocaleDateString('fr-FR')}`;
  doc.setFont(undefined, 'italic'); doc.setFontSize(8); doc.setTextColor(...C.subtle);
  doc.text(established, W / 2, H - 6, { align: 'center' });
}

// ─── Export 1 : Bordereau chiffré (DQE) — portrait, bouton dédié ─────────────
export async function generateTpBordereauPdf(study, opts = {}) {
  const chapters = study?.cadre?.chapters || [];
  const coef = { ...defaultCoefficients(), ...(study?.coefficients || {}) };
  const arts = collectArticles(chapters);
  const branding = await loadBranding(opts.companyId);

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const W = doc.internal.pageSize.getWidth();

  // En-tête simple (logo + entreprise + titre)
  let xText = 14;
  if (branding?.logo) {
    try { doc.addImage(branding.logo, imageFormat(branding.logo), 14, 12, 22, 22, undefined, 'FAST'); xText = 39; }
    catch { /* image invalide */ }
  }
  doc.setFont(undefined, 'bold'); doc.setFontSize(12); doc.setTextColor(...C.text);
  doc.text(branding?.companyName || study?.companyName || '', xText, 17);
  doc.setFont(undefined, 'normal'); doc.setFontSize(8); doc.setTextColor(...C.subtle);
  const lines = [branding?.address, [branding?.zip, branding?.city].filter(Boolean).join(' ')].filter(Boolean);
  let yy = 22;
  lines.forEach(l => { doc.text(String(l), xText, yy); yy += 3.5; });

  doc.setFont(undefined, 'bold'); doc.setFontSize(15); doc.setTextColor(...C.orange);
  doc.text('BORDEREAU CHIFFRÉ', W - 14, 18, { align: 'right' });
  doc.setFontSize(10); doc.setTextColor(...C.text);
  doc.text(study?.name || '', W - 14, 25, { align: 'right' });
  if (study?.reference) {
    doc.setFontSize(8); doc.setTextColor(...C.subtle);
    doc.text(`Réf : ${study.reference}`, W - 14, 30, { align: 'right' });
  }

  // Tableau
  const tot = { deb: 0, vente: 0 };
  const body = arts.map(({ node, num: refNum }) => {
    const qte = Number(node.qty || 0);
    const r = computeDetail(node.detail, qte, coef);
    tot.deb += r.deboursecSec; tot.vente += r.totalVente;
    return [refNum, node.designation || '', fr2(qte), node.unit || '', e2(r.puSec), e2(r.puRetenu), e2(r.totalVente)];
  });
  autoTable(doc, {
    startY: 40,
    head: [['N°', 'Désignation', 'Qté', 'U', 'PU sec', 'PU vente', 'Total vente']],
    body,
    foot: [['', { content: 'TOTAL HT', styles: { fontStyle: 'bold' } }, '', '', { content: e2(tot.deb), styles: { halign: 'right', fontStyle: 'bold' } }, '', { content: e2(tot.vente), styles: { halign: 'right', fontStyle: 'bold' } }]],
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 1.5, lineColor: C.border, lineWidth: 0.15, overflow: 'linebreak' },
    headStyles: { fillColor: C.orange, textColor: 255, fontStyle: 'bold', fontSize: 9 },
    footStyles: { fillColor: C.gray, textColor: C.text },
    columnStyles: { 0: { cellWidth: 16 }, 2: { halign: 'right' }, 3: { halign: 'center' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } },
    margin: { left: 14, right: 14 },
  });
  drawFooter(doc, { branding });

  const safeName = (study?.name || 'etude_tp').replace(/[^a-z0-9_-]/gi, '_');
  await saveFileWithPicker(doc.output('blob'), `ESTIMA_TP_${safeName}_Bordereau.pdf`, FILE_TYPES.pdf, PICKER_IDS.exportPdf);
}

// ─── Export 2 : Sous-détails de prix — paysage, matrice SPIE ─────────────────
export async function generateTpSousDetailPdf(study, opts = {}) {
  const chapters = study?.cadre?.chapters || [];
  const coef = { ...defaultCoefficients(), ...(study?.coefficients || {}) };
  const arts = collectArticles(chapters).filter(a => a.node.detail);
  if (arts.length === 0) throw new Error('Aucun article chiffré (avec sous-détail) à exporter.');
  const branding = await loadBranding(opts.companyId);

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });

  // 1 article = 1 page (matrice SPIE) — pas de page blanche en tête.
  arts.forEach(({ node, num: refNum }, idx) => {
    const qte = Number(node.qty || 0);
    const d = node.detail;
    const r = computeDetail(d, qte, coef);
    const duree = r.duree;

    const calcQte = detailCalcQty(d, qte);
    const hasCalc = num(d?.qteCalcul) > 0;
    const calcUnit = (d?.uniteCalcul || node.unit || '').trim();

    if (idx > 0) doc.addPage();
    const pageNum = idx + 1;
    drawHeader(doc, { branding, study, art: { node, num: refNum }, pageNum });
    drawBandeau(doc, { qte, unit: node.unit, calcQte, calcUnit, hasCalc, rdt: effectiveRendement(d, calcQte), duree });

    drawMatrix(doc, {
      d, qteLines: calcQte, qteCadre: qte, duree,
      sec: r.sec,
      puSecGlobal: r.puSec,
      puVenteGlobal: r.puRetenu,
      coef,
      unit: node.unit,
    });

    drawFooter(doc, { branding });
  });

  const safeName = (study?.name || 'etude_tp').replace(/[^a-z0-9_-]/gi, '_');
  await saveFileWithPicker(doc.output('blob'), `ESTIMA_TP_${safeName}_SousDetails.pdf`, FILE_TYPES.pdf, PICKER_IDS.exportPdf);
}
