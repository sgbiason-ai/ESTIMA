// src/components/mobile/SaveStatusDot.jsx
// Pastille de statut de sauvegarde partagée entre CRC et Visite de Site.

import React from 'react';

export default function SaveStatusDot({ status, className = '' }) {
  if (!status || status === 'idle') return null;

  const color =
    status === 'saved' ? 'bg-emerald-500' :
    status === 'saving' || status === 'waiting' ? 'bg-amber-500 animate-pulse' :
    'bg-red-500';

  const label =
    status === 'saved' ? 'Sauvegardé' :
    status === 'saving' ? 'Sauvegarde…' :
    status === 'waiting' ? 'En attente…' :
    'Erreur de sauvegarde';

  return (
    <span
      className={`w-2 h-2 rounded-full shrink-0 ${color} ${className}`}
      title={label}
    />
  );
}
