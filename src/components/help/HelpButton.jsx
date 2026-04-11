// src/components/help/HelpButton.jsx
// Bouton declencheur d'aide reutilisable.

import React from 'react';
import { HelpCircle } from 'lucide-react';

const HelpButton = ({ onClick, variant = 'header', label = 'Aide', className = '' }) => {
  if (variant === 'ribbon') {
    return (
      <button
        onClick={onClick}
        title="Afficher l'aide"
        className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors ${className}`}
      >
        <HelpCircle size={20} strokeWidth={1.5} />
        <span className="text-[10px] font-medium">{label}</span>
      </button>
    );
  }

  if (variant === 'inline') {
    return (
      <button
        onClick={onClick}
        title="Afficher l'aide"
        className={`flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors ${className}`}
      >
        <HelpCircle size={12} />{label}
      </button>
    );
  }

  // variant === 'header' (default)
  return (
    <button
      onClick={onClick}
      title="Afficher l'aide"
      className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-blue-600 hover:bg-blue-50 rounded-xl border border-blue-100 transition-all ${className}`}
    >
      <HelpCircle size={14} />{label}
    </button>
  );
};

export default HelpButton;
