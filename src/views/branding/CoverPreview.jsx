// src/views/branding/CoverPreview.jsx
// Apercu page de garde A4 — extrait de BrandingView.jsx

import React from 'react';
import { hexToRgbString, lightenHex } from '../../utils/colorHelpers';

const CoverPreview = ({ branding, activeDocType, project }) => {
  const docTypeLabel = {
    estimation: 'ESTIMATION CONFIDENTIELLE DES TRAVAUX',
    dqe:        'DÉTAIL QUANTITATIF ET ESTIMATIF',
    bpu:        'BORDEREAU DES PRIX UNITAIRES',
    cctp:       'CAHIER DES CLAUSES TECHNIQUES PARTICULIÈRES',
    rc:         'RÈGLEMENT DE LA CONSULTATION',
    analysis:   "ANALYSE COMPARATIVE DES OFFRES",
  }[activeDocType] || 'DOCUMENT DE MARCHÉ';

  const primary   = branding.colors.primary;
  const secondary = branding.colors.secondary;
  const textColor = branding.colors.text;
  const subtle    = branding.colors.subtle;
  const bgLight   = lightenHex(primary, 0.93);

  const headingFont = branding.fonts.headings;
  const mainFont    = branding.fonts.main;

  const today = new Date().toLocaleDateString('fr-FR');

  // Remplacement des données fictives par les données du projet
  const projectName = project?.name || 'NOM DU PROJET';
  const clientName = project?.client || 'NOM DU CLIENT';
  const clientAddress = project?.clientAddress || 'Adresse du client';
  const clientZip = project?.clientZip || '';
  const clientCity = project?.clientCity || 'VILLE';
  const location = project?.location || 'VILLE, DÉPARTEMENT';
  const phase = project?.phase || 'DCE';
  const code = project?.code || '2025-XXX';
  const clientLogo = project?.clientLogo || null;

  return (
    <div
      className="relative w-full overflow-hidden shadow-2xl"
      style={{
        aspectRatio: '210 / 297', // A4
        backgroundColor: '#FFFFFF',
        fontFamily: mainFont,
        borderRadius: '4px',
      }}
    >
      {/* Bande verticale gauche */}
      <div
        className="absolute top-0 left-0 bottom-0 w-[2.5%]"
        style={{ backgroundColor: primary }}
      />

      {/* En-tête logos */}
      <div className="absolute top-[3%] left-[5%] right-[5%] flex justify-between items-center h-[10%]">
        {/* Logo MOE */}
        <div className="h-full flex items-center">
          {branding.logo ? (
            <img
              src={branding.logo}
              alt="logo MOE"
              className="max-h-full max-w-[40%] object-contain"
            />
          ) : (
            <div
              className="h-full flex items-center justify-center px-3 rounded text-xs font-bold tracking-wide"
              style={{
                backgroundColor: bgLight,
                color: primary,
                fontFamily: headingFont,
                minWidth: '80px',
                fontSize: 'clamp(5px, 1.2vw, 11px)',
              }}
            >
              {branding.companyName || 'VOTRE SOCIÉTÉ'}
            </div>
          )}
        </div>

        {/* Logo client */}
        <div
          className="h-[70%] flex items-center justify-center rounded"
          style={{
            border: clientLogo ? 'none' : `1px dashed ${subtle}`,
            minWidth: '80px',
            fontSize: 'clamp(5px, 1vw, 9px)',
            color: subtle,
          }}
        >
          {clientLogo ? (
            <img src={clientLogo} alt="logo client" className="max-h-full max-w-full object-contain" loading="lazy" />
          ) : (
            <span className="opacity-40 px-3">LOGO CLIENT</span>
          )}
        </div>
      </div>

      {/* Ligne séparatrice */}
      <div
        className="absolute left-[5%] right-[5%]"
        style={{
          top: '14.5%',
          height: '1px',
          backgroundColor: `rgba(${hexToRgbString(primary)}, 0.15)`,
        }}
      />

      {/* Type de document */}
      <div
        className="absolute right-[5%] font-bold tracking-wider uppercase text-right"
        style={{
          top: '16%',
          color: subtle,
          fontFamily: headingFont,
          fontSize: 'clamp(4px, 1vw, 8px)',
          letterSpacing: '0.1em',
        }}
      >
        {docTypeLabel}
      </div>

      {/* Titre du projet */}
      <div
        className="absolute left-[5%] right-[5%] font-black leading-tight uppercase"
        style={{
          top: '28%',
          color: primary,
          fontFamily: headingFont,
          fontSize: 'clamp(10px, 3.5vw, 26px)',
        }}
      >
        {projectName}
      </div>

      {/* Trait de soulignement */}
      <div
        className="absolute"
        style={{
          top: '38%',
          left: '5%',
          width: '15%',
          height: '2px',
          backgroundColor: secondary,
          borderRadius: '1px',
        }}
      />

      {/* Bloc infos */}
      <div
        className="absolute left-[5%] right-[5%] rounded-lg"
        style={{
          top: '42%',
          height: '24%',
          backgroundColor: bgLight,
        }}
      >
        {/* Col gauche : MOA + lieu */}
        <div
          className="absolute top-[15%] left-[5%]"
          style={{ width: '42%' }}
        >
          <div
            className="font-bold uppercase tracking-widest mb-1"
            style={{
              color: subtle,
              fontFamily: headingFont,
              fontSize: 'clamp(3px, 0.8vw, 6px)',
            }}
          >
            MAÎTRE D'OUVRAGE
          </div>
          <div
            className="font-semibold uppercase"
            style={{
              color: textColor,
              fontFamily: headingFont,
              fontSize: 'clamp(5px, 1.2vw, 9px)',
            }}
          >
            {clientName}
          </div>
          <div
            style={{
              color: subtle,
              fontSize: 'clamp(4px, 0.9vw, 7px)',
              marginTop: '2px',
            }}
          >
            {clientAddress}
            <br />
            {clientZip} {clientCity}
          </div>

          <div
            className="font-bold uppercase tracking-widest mt-[8%]"
            style={{
              color: subtle,
              fontFamily: headingFont,
              fontSize: 'clamp(3px, 0.8vw, 6px)',
            }}
          >
            LIEU DE RÉALISATION
          </div>
          <div
            className="font-semibold uppercase truncate"
            style={{
              color: textColor,
              fontFamily: headingFont,
              fontSize: 'clamp(5px, 1.2vw, 9px)',
            }}
          >
            {location}
          </div>
        </div>

        {/* Séparateur vertical */}
        <div
          className="absolute top-[10%] bottom-[10%]"
          style={{
            left: '50%',
            width: '1px',
            backgroundColor: `rgba(${hexToRgbString(primary)}, 0.15)`,
          }}
        />

        {/* Col droite : Phase + Code */}
        <div
          className="absolute top-[15%]"
          style={{ left: '55%', right: '5%' }}
        >
          <div
            className="font-bold uppercase tracking-widest mb-1"
            style={{
              color: subtle,
              fontFamily: headingFont,
              fontSize: 'clamp(3px, 0.8vw, 6px)',
            }}
          >
            PHASE DU PROJET
          </div>
          <div
            className="inline-block font-bold text-white rounded px-2 py-0.5"
            style={{
              backgroundColor: primary,
              fontFamily: headingFont,
              fontSize: 'clamp(4px, 1vw, 7px)',
            }}
          >
            {phase}
          </div>

          <div
            className="font-bold uppercase tracking-widest mt-[8%]"
            style={{
              color: subtle,
              fontFamily: headingFont,
              fontSize: 'clamp(3px, 0.8vw, 6px)',
            }}
          >
            RÉFÉRENCE (CODE AFFAIRE)
          </div>
          <div
            className="font-semibold uppercase"
            style={{
              color: textColor,
              fontFamily: headingFont,
              fontSize: 'clamp(5px, 1.2vw, 9px)',
            }}
          >
            {code}
          </div>
        </div>
      </div>

      {/* Coordonnées MOE en bas */}
      {(branding.companyName || branding.address || branding.zip || branding.city || branding.phone || branding.email) && (
        <div
          className="absolute left-[5%] right-[5%]"
          style={{ bottom: '6%' }}
        >
          <div
            className="h-px mb-2"
            style={{ backgroundColor: `rgba(${hexToRgbString(primary)}, 0.15)` }}
          />
          <div className="flex justify-between items-end">
            <div>
              {branding.companyName && (
                <div
                  className="font-bold uppercase"
                  style={{
                    color: primary,
                    fontFamily: headingFont,
                    fontSize: 'clamp(4px, 1vw, 8px)',
                  }}
                >
                  {branding.companyName}
                </div>
              )}
              {branding.tagline && (
                <div
                  style={{
                    color: subtle,
                    fontSize: 'clamp(3px, 0.8vw, 6px)',
                  }}
                >
                  {branding.tagline}
                </div>
              )}
              {(branding.address || branding.zip || branding.city) && (
                <div
                  style={{
                    color: subtle,
                    fontSize: 'clamp(3px, 0.8vw, 6px)',
                    marginTop: '2px',
                  }}
                >
                  {branding.address}
                  {(branding.address && (branding.zip || branding.city)) && <br />}
                  {branding.zip} {branding.city}
                </div>
              )}
            </div>
            <div className="text-right">
              {branding.phone && (
                <div style={{ color: subtle, fontSize: 'clamp(3px, 0.8vw, 6px)' }}>
                  {branding.phone}
                </div>
              )}
              {branding.email && (
                <div style={{ color: subtle, fontSize: 'clamp(3px, 0.8vw, 6px)' }}>
                  {branding.email}
                </div>
              )}
              {branding.website && (
                <div
                  style={{
                    color: primary,
                    fontSize: 'clamp(3px, 0.8vw, 6px)',
                    fontWeight: 600,
                  }}
                >
                  {branding.website}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Date */}
      <div
        className="absolute right-[5%]"
        style={{
          bottom: '2%',
          color: subtle,
          fontSize: 'clamp(3px, 0.7vw, 5px)',
        }}
      >
        Édité le {today}
      </div>
    </div>
  );
};

export default CoverPreview;
