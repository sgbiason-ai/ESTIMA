// src/components/rao/SaveStatusIndicator.jsx
// Indicateur passif d'état de sauvegarde (pattern Google Docs) : remplace les
// boutons « Sauvegarder » alors que tout est déjà auto-sauvegardé.
// status : 'idle' | 'pending' | 'saving' | 'saved' | 'error'

import React from 'react';
import { Cloud, UploadCloud, CheckCircle2, AlertTriangle } from 'lucide-react';

const fmtTime = (d) => {
  try { return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
};

const SaveStatusIndicator = ({ status = 'idle', lastSaved = null, compact = false }) => {
  let icon, label, cls;
  if (status === 'saving' || status === 'pending') {
    icon = <UploadCloud size={compact ? 16 : 18} className="animate-pulse" />;
    label = 'Enregistrement…';
    cls = 'text-blue-500';
  } else if (status === 'error') {
    icon = <AlertTriangle size={compact ? 16 : 18} />;
    label = 'Erreur de sauvegarde';
    cls = 'text-red-500';
  } else if (status === 'saved' || lastSaved) {
    icon = <CheckCircle2 size={compact ? 16 : 18} />;
    label = lastSaved ? `Enregistré à ${fmtTime(lastSaved)}` : 'Enregistré';
    cls = 'text-emerald-500';
  } else {
    icon = <Cloud size={compact ? 16 : 18} />;
    label = 'Sauvegarde auto';
    cls = 'text-slate-400';
  }

  if (compact) {
    return (
      <span className={`inline-flex items-center justify-center p-2 ${cls}`} title={label}>
        {icon}
      </span>
    );
  }

  return (
    <div
      className="flex flex-col items-center justify-center gap-1 px-3 py-1.5 min-w-[88px]"
      title="Les modifications sont enregistrées automatiquement"
    >
      <span className={cls}>{icon}</span>
      <span className="text-[10px] leading-tight text-center text-slate-500">{label}</span>
    </div>
  );
};

export default SaveStatusIndicator;
