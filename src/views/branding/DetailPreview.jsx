// src/views/branding/DetailPreview.jsx
// Aperçu "intérieur" A4 de l'export Estimation / DQE.
// Maquette HTML temps réel calée sur le rendu réel de pdfGenerator.js :
// bandeau d'en-tête, tableau détail (chapitre / lignes / sous-total), bloc totaux.
// Données d'exemple — seul le STYLE (couleurs, polices, logo) reflète la charte.

import React from 'react';
import { hexToRgbString, lightenHex } from '../../utils/colorHelpers';
import { resolveAdvancedColors } from './brandingColors';

// ─── DONNÉES D'EXEMPLE (VRD) ──────────────────────────────────────────────────
const SAMPLE_CHAPTERS = [
  {
    title: 'TERRASSEMENTS GÉNÉRAUX',
    rows: [
      { ref: 'T.01', designation: 'Décapage de la terre végétale', unit: 'm²', qty: 1250, price: 4.5 },
      { ref: 'T.02', designation: 'Déblais en pleine masse', unit: 'm³', qty: 850, price: 12.8 },
      { ref: 'T.03', designation: "Remblais d'apport compactés", unit: 'm³', qty: 420, price: 18.5 },
    ],
  },
  {
    title: 'VOIRIE & RÉSEAUX DIVERS',
    rows: [
      { ref: 'V.01', designation: 'Grave non traitée 0/31,5', unit: 'm³', qty: 320, price: 32 },
      { ref: 'V.02', designation: 'Enrobé BBSG 0/10 ép. 6 cm', unit: 'T', qty: 145, price: 95 },
      { ref: 'V.03', designation: 'Bordure béton T2 posée', unit: 'ml', qty: 380, price: 24 },
    ],
  },
];

const fmt = (n) =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const DetailPreview = ({ branding, activeDocType = 'estimation', project }) => {
  const isDQE = activeDocType === 'dqe';

  const primary   = branding.colors.primary;
  const secondary = branding.colors.secondary;
  const textColor = branding.colors.text;
  const subtle    = branding.colors.subtle;

  const headingFont = branding.fonts.headings;
  const mainFont    = branding.fonts.main;

  // Couleurs avancées résolues (override ou dérivée "auto") — source unique
  const adv = resolveAdvancedColors(branding.colors);
  const tableHeader = adv.tableHeader; // fond en-tête tableau
  const chapterBg   = adv.chapterBg;   // fond ligne chapitre
  const altBg       = adv.tableAlt;    // lignes alternées + sous-total
  const pse         = adv.pse;         // PSE / options
  const pseBg       = lightenHex(pse, 0.88);
  const borderCol = `rgba(${hexToRgbString(primary)}, 0.18)`;

  const today = new Date().toLocaleDateString('fr-FR');
  const projectName = (project?.name || 'NOM DU PROJET').toUpperCase();
  const phase = (project?.phase || 'DCE').toUpperCase();
  const tvaRate = Number(project?.tauxTVA ?? 20);

  // Totaux
  const grandTotal = SAMPLE_CHAPTERS.reduce(
    (s, c) => s + c.rows.reduce((cs, r) => cs + r.qty * r.price, 0),
    0
  );
  const tva = grandTotal * (tvaRate / 100);
  const ttc = grandTotal + tva;

  // Tailles fluides (mêmes conventions que CoverPreview)
  const fsHead   = 'clamp(4px, 1vw, 8px)';
  const fsBody   = 'clamp(3.5px, 0.95vw, 7.5px)';
  const fsTitle  = 'clamp(6px, 1.6vw, 13px)';
  const fsBand   = 'clamp(3.5px, 0.85vw, 6.5px)';
  const fsTotal  = 'clamp(4px, 1.1vw, 9px)';

  const cellPad = '2.5px 4px';

  return (
    <div
      className="relative w-full overflow-hidden shadow-2xl"
      style={{
        aspectRatio: '210 / 297',
        backgroundColor: '#FFFFFF',
        fontFamily: mainFont,
        borderRadius: '4px',
        padding: '5%',
      }}
    >
      {/* ── EN-TÊTE ──────────────────────────────────────────────── */}
      <div className="relative flex items-start justify-between" style={{ minHeight: '12%' }}>
        {/* Bloc titre centré */}
        <div className="flex-1 flex flex-col items-center justify-start pt-1">
          <div
            className="inline-block font-bold rounded"
            style={{
              backgroundColor: chapterBg,
              border: `1px solid ${secondary}`,
              color: '#000',
              fontFamily: headingFont,
              fontSize: fsBand,
              padding: '2px 8px',
              letterSpacing: '0.05em',
            }}
          >
            {isDQE ? 'DÉTAIL QUANTITATIF ET ESTIMATIF' : 'ESTIMATION CONFIDENTIELLE'}
          </div>
          <div
            className="font-bold text-center uppercase leading-tight mt-1 px-2"
            style={{ color: '#000', fontFamily: headingFont, fontSize: fsHead }}
          >
            {projectName}
          </div>
        </div>

        {/* Logo MOE */}
        <div className="absolute right-0 top-0 h-[55%] flex items-start justify-end" style={{ maxWidth: '32%' }}>
          {branding.logo ? (
            <img src={branding.logo} alt="logo MOE" className="max-h-full max-w-full object-contain" />
          ) : (
            <div
              className="flex items-center justify-center px-2 py-1 rounded font-bold"
              style={{
                backgroundColor: lightenHex(primary, 0.93),
                color: primary,
                fontFamily: headingFont,
                fontSize: 'clamp(3.5px, 0.85vw, 7px)',
              }}
            >
              {branding.companyName || 'VOTRE SOCIÉTÉ'}
            </div>
          )}
        </div>

        {/* N° de page */}
        <div
          className="absolute right-0"
          style={{ top: '58%', color: '#000', fontSize: 'clamp(3px, 0.7vw, 5.5px)' }}
        >
          PAGE : 1 / 3
        </div>
      </div>

      {/* Bande phase / date */}
      <div
        className="w-full rounded-sm text-center"
        style={{
          backgroundColor: altBg,
          color: '#000',
          fontSize: fsBand,
          padding: '2px 0',
          marginTop: '2%',
          fontFamily: headingFont,
          letterSpacing: '0.06em',
        }}
      >
        PHASE : {phase}&nbsp;&nbsp;-&nbsp;&nbsp;DATE : {today}
      </div>

      {/* ── TITRE SECTION ────────────────────────────────────────── */}
      <div
        className="font-bold uppercase"
        style={{ color: primary, fontFamily: headingFont, fontSize: fsTitle, margin: '4% 0 2%' }}
      >
        Détail quantitatif — Global
      </div>

      {/* ── TABLEAU DÉTAIL ───────────────────────────────────────── */}
      <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '9%' }} />
          <col style={{ width: 'auto' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '16%' }} />
          <col style={{ width: '17%' }} />
        </colgroup>
        <thead>
          <tr style={{ backgroundColor: tableHeader, color: '#FFF' }}>
            {['N°', 'DÉSIGNATION DES OUVRAGES', 'U', 'QTÉ', 'P.U. HT', 'TOTAL HT'].map((h) => (
              <th
                key={h}
                className="font-bold"
                style={{
                  fontFamily: headingFont,
                  fontSize: fsHead,
                  padding: cellPad,
                  textAlign: 'center',
                  border: `0.5px solid ${tableHeader}`,
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SAMPLE_CHAPTERS.map((chap, ci) => {
            const chapTotal = chap.rows.reduce((s, r) => s + r.qty * r.price, 0);
            return (
              <React.Fragment key={chap.title}>
                {/* Ligne chapitre */}
                <tr style={{ backgroundColor: chapterBg }}>
                  <td
                    colSpan={6}
                    className="font-bold uppercase"
                    style={{
                      color: textColor,
                      fontFamily: headingFont,
                      fontSize: fsHead,
                      padding: '2.5px 6px',
                      border: `0.5px solid ${borderCol}`,
                    }}
                  >
                    {ci + 1}. {chap.title}
                  </td>
                </tr>

                {/* Lignes d'articles */}
                {chap.rows.map((r, ri) => {
                  const lineTotal = r.qty * r.price;
                  const bg = ri % 2 === 1 ? altBg : '#FFFFFF';
                  return (
                    <tr key={r.ref} style={{ backgroundColor: bg }}>
                      <td style={{ ...tdBase(borderCol, cellPad, fsBody, textColor), textAlign: 'center', fontWeight: 700 }}>
                        {r.ref}
                      </td>
                      <td style={{ ...tdBase(borderCol, cellPad, fsBody, textColor), textAlign: 'left' }}>
                        {r.designation.toUpperCase()}
                      </td>
                      <td style={{ ...tdBase(borderCol, cellPad, fsBody, textColor), textAlign: 'center' }}>
                        {r.unit}
                      </td>
                      <td style={{ ...tdBase(borderCol, cellPad, fsBody, textColor), textAlign: 'center' }}>
                        {fmt(r.qty)}
                      </td>
                      <td style={{ ...tdBase(borderCol, cellPad, fsBody, textColor), textAlign: 'right' }}>
                        {isDQE ? '' : fmt(r.price)}
                      </td>
                      <td style={{ ...tdBase(borderCol, cellPad, fsBody, textColor), textAlign: 'right' }}>
                        {isDQE ? '' : fmt(lineTotal)}
                      </td>
                    </tr>
                  );
                })}

                {/* Sous-total */}
                <tr style={{ backgroundColor: altBg }}>
                  <td style={{ ...tdBase(borderCol, cellPad, fsBody, textColor) }} />
                  <td
                    colSpan={4}
                    className="font-bold"
                    style={{
                      ...tdBase(borderCol, cellPad, fsBody, textColor),
                      textAlign: 'right',
                      fontWeight: 700,
                    }}
                  >
                    SOUS-TOTAL {ci + 1}. {chap.title}
                  </td>
                  <td
                    className="font-bold"
                    style={{
                      ...tdBase(borderCol, cellPad, fsBody, textColor),
                      textAlign: 'right',
                      fontWeight: 700,
                    }}
                  >
                    {isDQE ? '' : `${fmt(chapTotal)} €`}
                  </td>
                </tr>
              </React.Fragment>
            );
          })}

          {/* Section PSE / Options — montre la couleur PSE */}
          <tr style={{ backgroundColor: pseBg }}>
            <td
              colSpan={6}
              className="font-bold uppercase text-center"
              style={{
                color: pse,
                fontFamily: headingFont,
                fontSize: fsHead,
                padding: '2.5px 6px',
                border: `0.5px solid ${pseBg}`,
              }}
            >
              Options / Prestations supplémentaires
            </td>
          </tr>
          {[
            { ref: 'O.01', designation: 'Noue paysagère engazonnée', unit: 'ml', qty: 120, price: 38 },
            { ref: 'O.02', designation: 'Massif arbustif planté', unit: 'm²', qty: 85, price: 45 },
          ].map((r, ri) => (
            <tr key={r.ref} style={{ backgroundColor: ri % 2 === 1 ? pseBg : '#FFFFFF' }}>
              <td style={{ ...tdBase(borderCol, cellPad, fsBody, pse), textAlign: 'center', fontWeight: 700 }}>{r.ref}</td>
              <td style={{ ...tdBase(borderCol, cellPad, fsBody, pse), textAlign: 'left' }}>{r.designation.toUpperCase()}</td>
              <td style={{ ...tdBase(borderCol, cellPad, fsBody, pse), textAlign: 'center' }}>{r.unit}</td>
              <td style={{ ...tdBase(borderCol, cellPad, fsBody, pse), textAlign: 'center' }}>{fmt(r.qty)}</td>
              <td style={{ ...tdBase(borderCol, cellPad, fsBody, pse), textAlign: 'right' }}>{isDQE ? '' : fmt(r.price)}</td>
              <td style={{ ...tdBase(borderCol, cellPad, fsBody, pse), textAlign: 'right' }}>{isDQE ? '' : fmt(r.qty * r.price)}</td>
            </tr>
          ))}
          <tr style={{ backgroundColor: pseBg }}>
            <td style={{ ...tdBase(borderCol, cellPad, fsBody, pse) }} />
            <td colSpan={4} className="font-bold" style={{ ...tdBase(borderCol, cellPad, fsBody, pse), textAlign: 'right', fontWeight: 700 }}>
              SOUS-TOTAL PSE
            </td>
            <td className="font-bold" style={{ ...tdBase(borderCol, cellPad, fsBody, pse), textAlign: 'right', fontWeight: 700 }}>
              {isDQE ? '' : `${fmt(120 * 38 + 85 * 45)} €`}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── BLOC TOTAUX ──────────────────────────────────────────── */}
      {!isDQE && (
        <div className="flex flex-col items-end" style={{ marginTop: '5%', gap: '3px' }}>
          <div className="font-bold" style={{ color: textColor, fontFamily: headingFont, fontSize: fsTotal }}>
            TOTAL GÉNÉRAL HT (Hors PSE) : {fmt(grandTotal)} €
          </div>
          <div style={{ color: subtle, fontSize: fsHead }}>
            T.V.A. ({String(tvaRate).replace('.', ',')}%) : {fmt(tva)} €
          </div>
          <div
            className="font-bold"
            style={{
              color: primary,
              fontFamily: headingFont,
              fontSize: 'clamp(5px, 1.3vw, 11px)',
              marginTop: '2px',
            }}
          >
            TOTAL GÉNÉRAL TTC : {fmt(ttc)} €
          </div>
        </div>
      )}

      {/* Filigrane "exemple" discret */}
      <div
        className="absolute left-[5%]"
        style={{ bottom: '2%', color: subtle, fontSize: 'clamp(3px, 0.7vw, 5px)', fontStyle: 'italic' }}
      >
        Données d'exemple — seul le style reflète votre charte
      </div>
    </div>
  );
};

// Style de base d'une cellule de corps
const tdBase = (borderCol, padding, fontSize, color) => ({
  border: `0.5px solid ${borderCol}`,
  padding,
  fontSize,
  color,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

export default DetailPreview;
