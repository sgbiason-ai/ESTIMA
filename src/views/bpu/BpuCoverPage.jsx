import React from 'react';
import { PAGE_WIDTH_PX, PAGE_HEIGHT_PX } from './constants/bpuLayout';
import { getCurrentPhase } from '../../utils/phaseModel';

/**
 * BpuCoverPage
 * Div cachée (display: none) rendue dans le DOM et capturée par html2canvas
 * pour générer la page de garde du PDF.
 *
 * Mise en page calquée sur l'export Word (useBpuWordExport) : page sobre,
 * titre à droite, gros nom de projet, trait secondaire pleine largeur, puis
 * blocs Maître d'ouvrage / Lieu de réalisation / Phase / Code affaire en pile.
 * Seul ajout par rapport au Word : le(s) logo(s) conservé(s) en haut.
 */
const BpuCoverPage = ({ project, branding, resolvedLogo, onLogoError }) => {
  const { colors, fonts } = branding;
  const head = fonts.headings;

  return (
    <div
      id="bpu-pdf-cover"
      style={{
        display: 'none',
        position: 'fixed', top: 0, left: 0,
        width: `${PAGE_WIDTH_PX}px`, height: `${PAGE_HEIGHT_PX}px`,
        backgroundColor: '#FFFFFF', zIndex: -9999,
        fontFamily: fonts.main, boxSizing: 'border-box',
        padding: '72px 90px',
      }}
    >
      {/* Logo(s) en haut (seul ajout vs Word) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '70px', marginBottom: '40px' }}>
        <div style={{ height: '100%', display: 'flex', alignItems: 'center' }}>
          {resolvedLogo && (
            <img src={resolvedLogo} alt="logo MOE" style={{ maxHeight: '100%', maxWidth: '260px', objectFit: 'contain' }} onError={onLogoError} loading="lazy" />
          )}
        </div>
        <div style={{ height: '70%', display: 'flex', alignItems: 'center' }}>
          {project?.clientLogo && (
            <img src={project.clientLogo} alt="logo client" style={{ maxHeight: '100%', maxWidth: '200px', objectFit: 'contain' }} loading="lazy" />
          )}
        </div>
      </div>

      {/* Sous-titre (aligné à droite, comme le Word) */}
      <div style={{ marginTop: '40px', marginBottom: '46px', textAlign: 'right', fontWeight: 'bold', textTransform: 'uppercase', color: colors.subtle, fontFamily: head, fontSize: '15px', letterSpacing: '0.06em' }}>
        Bordereau des Prix Unitaires
      </div>

      {/* Titre projet */}
      <div style={{ marginBottom: '18px', fontWeight: 900, lineHeight: 1.15, textTransform: 'uppercase', color: colors.primary, fontFamily: head, fontSize: '34px' }}>
        {project?.name || 'NOM DU PROJET'}
      </div>

      {/* Trait accent pleine largeur (comme la bordure basse du Word) */}
      <div style={{ height: '3px', width: '100%', backgroundColor: colors.secondary, marginBottom: '88px' }} />

      {/* Maître d'ouvrage */}
      <div style={{ marginBottom: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.08em', color: colors.subtle, fontFamily: head, fontSize: '13px' }}>
        Maître d'ouvrage
      </div>
      <div style={{ marginBottom: '5px', fontWeight: 'bold', textTransform: 'uppercase', color: colors.text, fontFamily: head, fontSize: '19px' }}>
        {project?.client || 'NOM DU CLIENT'}
      </div>
      <div style={{ color: colors.subtle, fontSize: '14px', lineHeight: 1.5 }}>{project?.clientAddress || 'Adresse du client'}</div>
      <div style={{ marginBottom: '44px', color: colors.subtle, fontSize: '14px', lineHeight: 1.5 }}>
        {project?.clientZip || ''} {project?.clientCity || ''}
      </div>

      {/* Lieu de réalisation */}
      <div style={{ marginBottom: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.08em', color: colors.subtle, fontFamily: head, fontSize: '13px' }}>
        Lieu de réalisation
      </div>
      <div style={{ marginBottom: '80px', fontWeight: 'bold', textTransform: 'uppercase', color: colors.text, fontFamily: head, fontSize: '19px' }}>
        {project?.location || 'VILLE, DÉPARTEMENT'}
      </div>

      {/* Phase */}
      <div style={{ marginBottom: '16px', fontFamily: head }}>
        <span style={{ fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.04em', color: colors.subtle, fontSize: '15px' }}>Phase : </span>
        <span style={{ fontWeight: 'bold', textTransform: 'uppercase', color: colors.primary, fontSize: '16px' }}>{getCurrentPhase(project)?.code || 'DCE'}</span>
      </div>

      {/* Code affaire */}
      <div style={{ fontFamily: head }}>
        <span style={{ fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.04em', color: colors.subtle, fontSize: '15px' }}>Code affaire : </span>
        <span style={{ fontWeight: 'bold', textTransform: 'uppercase', color: colors.text, fontSize: '16px' }}>{project?.code || '2025-XXX'}</span>
      </div>
    </div>
  );
};

export default BpuCoverPage;
