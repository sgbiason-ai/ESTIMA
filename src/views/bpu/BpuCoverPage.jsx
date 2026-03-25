import React from 'react';
import { hexToRgb, lighten } from './utils/bpuBrandingUtils';
import { PAGE_WIDTH_PX, PAGE_HEIGHT_PX } from './constants/bpuLayout';

/**
 * BpuCoverPage
 * Div cachée (display: none) rendue dans le DOM et capturée par html2canvas
 * pour générer la page de garde du PDF.
 */
const BpuCoverPage = ({ project, branding, resolvedLogo, today, onLogoError }) => {
  const { colors, fonts, companyName, tagline, address, phone, email, website } = branding;

  return (
    <div
      id="bpu-pdf-cover"
      style={{
        display: 'none',
        position: 'fixed', top: 0, left: 0,
        width: `${PAGE_WIDTH_PX}px`, height: `${PAGE_HEIGHT_PX}px`,
        backgroundColor: '#FFFFFF', zIndex: -9999,
        fontFamily: fonts.main,
      }}
    >
      {/* Bande couleur gauche */}
      <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '2.5%', backgroundColor: colors.primary }} />

      {/* Logos (MOE + client) */}
      <div style={{ position: 'absolute', top: '3%', left: '5%', right: '5%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '10%' }}>
        <div style={{ height: '100%', display: 'flex', alignItems: 'center' }}>
          {resolvedLogo ? (
            <img src={resolvedLogo} alt="logo MOE" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} onError={onLogoError} />
          ) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 12px', borderRadius: '4px', backgroundColor: lighten(colors.primary, 0.93), color: colors.primary, fontFamily: fonts.headings, minWidth: '80px', fontSize: '14px', fontWeight: 'bold' }}>
              {companyName || 'VOTRE SOCIÉTÉ'}
            </div>
          )}
        </div>
        <div style={{ height: '70%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {project?.clientLogo && (
            <img src={project.clientLogo} alt="logo client" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
          )}
        </div>
      </div>

      {/* Séparateur */}
      <div style={{ position: 'absolute', left: '5%', right: '5%', top: '14.5%', height: '1px', backgroundColor: `rgba(${hexToRgb(colors.primary)}, 0.15)` }} />

      {/* Sous-titre */}
      <div style={{ position: 'absolute', right: '5%', top: '16%', fontWeight: 'bold', textTransform: 'uppercase', textAlign: 'right', color: colors.subtle, fontFamily: fonts.headings, fontSize: '12px', letterSpacing: '0.1em' }}>
        BORDEREAU DES PRIX UNITAIRES
      </div>

      {/* Titre projet */}
      <div style={{ position: 'absolute', left: '5%', right: '5%', top: '28%', fontWeight: 900, lineHeight: 1.2, textTransform: 'uppercase', color: colors.primary, fontFamily: fonts.headings, fontSize: '36px' }}>
        {project?.name || 'NOM DU PROJET'}
      </div>

      {/* Trait accent */}
      <div style={{ position: 'absolute', top: '38%', left: '5%', width: '15%', height: '2px', backgroundColor: colors.secondary, borderRadius: '1px' }} />

      {/* Bloc infos projet */}
      <div style={{ position: 'absolute', left: '5%', right: '5%', top: '42%', height: '24%', backgroundColor: lighten(colors.primary, 0.93), borderRadius: '8px' }}>
        {/* Colonne gauche */}
        <div style={{ position: 'absolute', top: '15%', left: '5%', width: '42%' }}>
          <div style={{ fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px', color: colors.subtle, fontFamily: fonts.headings, fontSize: '10px' }}>MAÎTRE D'OUVRAGE</div>
          <div style={{ fontWeight: 600, textTransform: 'uppercase', color: colors.text, fontFamily: fonts.headings, fontSize: '16px' }}>{project?.client || 'NOM DU CLIENT'}</div>
          <div style={{ color: colors.subtle, fontSize: '12px', marginTop: '2px' }}>
            {project?.clientAddress || ''}<br />{project?.clientZip || ''} {project?.clientCity || ''}
          </div>
          <div style={{ fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '15%', color: colors.subtle, fontFamily: fonts.headings, fontSize: '10px' }}>LIEU DE RÉALISATION</div>
          <div style={{ fontWeight: 600, textTransform: 'uppercase', color: colors.text, fontFamily: fonts.headings, fontSize: '16px' }}>{project?.location || 'VILLE, DÉPARTEMENT'}</div>
        </div>

        {/* Séparateur vertical */}
        <div style={{ position: 'absolute', top: '10%', bottom: '10%', left: '50%', width: '1px', backgroundColor: `rgba(${hexToRgb(colors.primary)}, 0.15)` }} />

        {/* Colonne droite */}
        <div style={{ position: 'absolute', top: '15%', left: '55%', right: '5%' }}>
          <div style={{ fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px', color: colors.subtle, fontFamily: fonts.headings, fontSize: '10px' }}>PHASE DU PROJET</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#FFFFFF', borderRadius: '4px', padding: '0 12px', height: '24px', backgroundColor: colors.primary, fontFamily: fonts.headings, fontSize: '13px', textTransform: 'uppercase' }}>
            {project?.phase || 'DCE'}
          </div>
          <div style={{ fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '15%', color: colors.subtle, fontFamily: fonts.headings, fontSize: '10px' }}>RÉFÉRENCE (CODE AFFAIRE)</div>
          <div style={{ fontWeight: 600, textTransform: 'uppercase', color: colors.text, fontFamily: fonts.headings, fontSize: '16px' }}>{project?.code || '2025-XXX'}</div>
        </div>
      </div>

      {/* Pied de page — coordonnées société */}
      {(companyName || address || phone || email) && (
        <div style={{ position: 'absolute', left: '5%', right: '5%', bottom: '6%' }}>
          <div style={{ height: '1px', marginBottom: '8px', backgroundColor: `rgba(${hexToRgb(colors.primary)}, 0.15)` }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              {companyName && <div style={{ fontWeight: 'bold', color: colors.text, fontSize: '11px' }}>{companyName}</div>}
              {address    && <div style={{ color: colors.subtle, fontSize: '10px' }}>{address}</div>}
              {tagline    && <div style={{ color: colors.subtle, fontSize: '10px', fontStyle: 'italic' }}>{tagline}</div>}
            </div>
            <div style={{ textAlign: 'right' }}>
              {phone   && <div style={{ color: colors.subtle, fontSize: '10px' }}>{phone}</div>}
              {email   && <div style={{ color: colors.subtle, fontSize: '10px' }}>{email}</div>}
              {website && <div style={{ color: colors.primary, fontSize: '10px', fontWeight: 600 }}>{website}</div>}
            </div>
          </div>
        </div>
      )}

      {/* Date d'édition */}
      <div style={{ position: 'absolute', right: '5%', bottom: '2%', color: colors.subtle, fontSize: '9px' }}>
        Édité le {today}
      </div>
    </div>
  );
};

export default BpuCoverPage;