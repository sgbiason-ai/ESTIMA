// src/components/common/CoEditBanner.jsx
//
// Bannière d'alerte de co-édition.
// Affichée quand un ou plusieurs AUTRES utilisateurs sont sur la même entité
// (projet, RAO, CRC, devis MOE, doc admin, visite…). EstimaVRD ne pose pas de
// verrou : si deux personnes éditent en parallèle, la dernière sauvegarde
// écrase l'autre. Cette bannière prévient ce risque.
//
// Persistante non-fermable : disparaît seule quand les autres quittent
// (présence temps réel via useCoEditors). Variante mobile haute lisibilité.

import React from 'react';
import PropTypes from 'prop-types';
import { AlertTriangle } from 'lucide-react';

/** Construit la phrase "X" / "X et Y" / "X et 2 autres" */
function formatEditors(editors) {
  const names = editors.map(e => e.displayName || e.email?.split('@')[0] || 'Un collègue');
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} et ${names[1]}`;
  return `${names[0]} et ${names.length - 1} autres`;
}

const CoEditBanner = ({ editors = [], variant = 'desktop' }) => {
  if (!editors || editors.length === 0) return null;

  const who = formatEditors(editors);
  const verb = editors.length === 1 ? 'modifie' : 'modifient';
  const message = `${who} ${verb} actuellement cet élément. Vos modifications risquent d'écraser les siennes (et inversement) — coordonnez-vous avant d'enregistrer.`;

  if (variant === 'mobile') {
    return (
      <div className="flex items-start gap-2.5 px-3 py-2.5 bg-amber-100 border-b border-amber-300 text-amber-900">
        <AlertTriangle size={18} strokeWidth={2} className="shrink-0 mt-0.5 text-amber-700" />
        <p className="text-[13px] font-semibold leading-snug">{message}</p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-6 py-2.5 bg-amber-50 border-b border-amber-200 text-amber-900">
      <AlertTriangle size={18} strokeWidth={2} className="shrink-0 text-amber-600" />
      <p className="text-[13px] font-medium leading-snug">
        <span className="font-bold">{who}</span>{' '}
        {verb} actuellement cet élément. Vos modifications risquent d'écraser les siennes —
        coordonnez-vous avant d'enregistrer.
      </p>
    </div>
  );
};

CoEditBanner.propTypes = {
  editors: PropTypes.arrayOf(PropTypes.shape({
    uid: PropTypes.string,
    displayName: PropTypes.string,
    email: PropTypes.string,
  })),
  variant: PropTypes.oneOf(['desktop', 'mobile']),
};

export default CoEditBanner;
