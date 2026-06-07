// src/components/rao/tabs/nego/NegoLetterPreview.jsx
//
// Aperçu A4 read-only du courrier (fidèle au PDF). Les éléments structurels
// (date, destinataire/expéditeur, objet) sont rendus en JSX pour garantir la
// mise en page ; le corps de lettre provient de letterHtml via
// stripStructuralFromHtml + dangerouslySetInnerHTML.

import React from 'react';
import { stripStructuralFromHtml } from './negoLetterUtils';

const NegoLetterPreview = ({ letterHtml, branding, project, selectedCompany, consultation = {}, letterConfig = {} }) => {
  const primaryColor = branding?.colors?.primary || '#286e55'; // vert papyrus par défaut
  const bodyHtml = stripStructuralFromHtml(letterHtml);
  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const ville = letterConfig.city || consultation?.lieu || '[Ville]';
  const objet = consultation?.objet || '[Objet du marché]';
  const adresseEnt = letterConfig.adresseEntreprise || '';
  const adresseExp = letterConfig.adresseExpediteur || '';

  return (
    <div className="rounded-3xl border border-slate-300 shadow-sm overflow-hidden nego-paper-preview-wrapper">
      <div className="nego-paper-preview-page">
        {/* Bande verticale primary (gauche) — couleur dynamique branding */}
        <div className="nego-paper-preview-band" style={{ background: primaryColor }} />
        {/* Logo en haut à gauche — prioritairement MOA (client), fallback MOE */}
        <img
          src={project?.clientLogo || branding?.logo || '/logo.jpg'}
          alt="Logo MOA / MOE"
          className="nego-paper-preview-logo"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
        {/* Date alignée à droite */}
        <p style={{ textAlign: 'right', margin: '0 0 12px 0', fontSize: '10pt' }}>
          {ville}, le {today}
        </p>
        {/* Destinataire (gauche) + Expéditeur (droite) */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <div style={{ flex: 55, border: '1px solid #000', fontSize: '10pt' }}>
            <div style={{ borderBottom: '1px solid #000', textAlign: 'center', padding: '4px 6px' }}>DESTINATAIRE :</div>
            <div style={{ padding: '8px 6px', minHeight: '60px', whiteSpace: 'pre-line' }}>
              <strong>{selectedCompany || '[Entreprise]'}</strong>{adresseEnt && (<>{'\n'}{adresseEnt}</>)}
            </div>
          </div>
          <div style={{ flex: 45, border: '1px solid #000', fontSize: '10pt' }}>
            <div style={{ borderBottom: '1px solid #000', textAlign: 'center', padding: '4px 6px' }}>EXPÉDITEUR :</div>
            <div style={{ padding: '8px 6px', minHeight: '60px', whiteSpace: 'pre-line' }}>
              <strong>{consultation?.client || '[Client / MOA]'}</strong>{adresseExp && (<>{'\n'}{adresseExp}</>)}
            </div>
          </div>
        </div>
        {/* Objet */}
        <p style={{ margin: '6px 0 2px 0', fontSize: '10pt' }}>
          <strong>OBJET :</strong>  <strong>{objet}</strong>
        </p>
        <p style={{ margin: '0 0 6px 0', fontSize: '10pt' }}>
          <strong>Négociation avec les candidats</strong>
        </p>
        {/* Cadre corps de lettre */}
        <div style={{ border: '1px solid #000', padding: '10px 12px' }}>
          <div
            className="nego-paper-preview-body"
            dangerouslySetInnerHTML={{ __html: bodyHtml || '<p style="color:#94a3b8; font-style:italic;">Sélectionnez une entreprise puis cliquez sur « Prix atypiques » pour générer le courrier.</p>' }}
          />
        </div>
        {/* Footer fidèle au PDF */}
        <div className="nego-paper-preview-footer">
          <span>{consultation?.client || 'Maître d\'œuvre'}</span>
          <span>Document confidentiel — usage strictement professionnel</span>
          <span>Page 1 / 1</span>
        </div>
      </div>
    </div>
  );
};

export default NegoLetterPreview;
