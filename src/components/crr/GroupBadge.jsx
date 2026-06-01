// src/components/crr/GroupBadge.jsx
// Pastille de groupe partagee (MOA, MDBDP, CONC...) a LARGEUR FIXE.
// Utilisee partout (observations, participants, modal, mobile) pour aligner
// les libelles qui suivent les pastilles, quelle que soit l'abreviation.
import React, { memo } from 'react';
import { X } from 'lucide-react';
import { getGroupColor, abbreviateGroup } from '../../data/crrData';

// Largeur fixe compacte (~5 lettres en 9px). Modifier ici = impact partout.
export const GROUP_BADGE_WIDTH = 'w-[52px]';

const GroupBadge = memo(({ name, colorIndex = 0, onRemove, className = '' }) => {
  const c = getGroupColor(colorIndex);
  const abbr = abbreviateGroup(name);
  return (
    <span
      title={name}
      className={`inline-flex items-center justify-center gap-1 rounded-full border font-bold leading-none whitespace-nowrap text-[9px] px-1 py-0.5 shrink-0 ${
        onRemove ? 'min-w-[52px]' : GROUP_BADGE_WIDTH
      } ${c.bg} ${c.text} ${c.border} ${className}`}
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
