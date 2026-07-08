// src/components/crr/GroupBadge.jsx
// Pastille de groupe partagee (MOA, MDBDP, CONC...) a LARGEUR FIXE.
// Utilisee partout (observations, participants, modal, mobile) pour aligner
// les libelles qui suivent les pastilles, quelle que soit l'abreviation.
import React, { memo } from 'react';
import { X } from 'lucide-react';
import { getGroupColor, abbreviateGroup } from '../../data/crrData';

// Largeur fixe compacte (~5 lettres en 9px). Modifier ici = impact partout.
export const GROUP_BADGE_WIDTH = 'w-[52px]';

const GroupBadge = memo(({ name, badgeName, colorIndex = 0, onRemove, onDoubleClick, className = '' }) => {
  const c = getGroupColor(colorIndex);
  const abbr = badgeName ? abbreviateGroup(badgeName) : abbreviateGroup(name);
  return (
    <span
      title={name}
      onDoubleClick={onDoubleClick}
      // min-width (et non largeur fixe) : la pastille garde un gabarit commun
      // pour l'alignement mais s'elargit pour les abreviations longues (PAPYR,
      // DESSE...) au lieu de laisser le texte deborder.
      className={`inline-flex items-center justify-center gap-1 rounded-full border font-bold leading-none whitespace-nowrap text-[9px] px-1.5 py-0.5 shrink-0 min-w-[52px] ${onDoubleClick ? 'cursor-text' : ''} ${c.bg} ${c.text} ${c.border} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot} shrink-0`} />
      {abbr}
      {onRemove && (
        <button onClick={onRemove} className="hover:opacity-70 -mr-0.5 shrink-0">
          <X size={8} />
        </button>
      )}
    </span>
  );
});

export default GroupBadge;
