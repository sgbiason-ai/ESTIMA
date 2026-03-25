// src/components/common/StarButton.jsx
//
// Bouton étoile à intégrer dans CctpSidebar / RcSidebar sur chaque nœud.
//
// Usage :
//   <StarButton
//     isFavorite={isFavorite(node.id, 'cctp')}
//     onToggle={() => toggleFavorite(node, 'cctp')}
//   />

import React from 'react';
import { Star } from 'lucide-react';

const StarButton = ({ isFavorite, onToggle, size = 13 }) => (
  <button
    type="button"
    onClick={(e) => { e.stopPropagation(); onToggle(); }}
    title={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
    className={`p-1 rounded transition-all duration-150 ${
      isFavorite
        ? 'text-amber-400 hover:text-amber-500 hover:bg-amber-50'
        : 'text-slate-300 hover:text-amber-400 hover:bg-amber-50 opacity-0 group-hover:opacity-100'
    }`}
  >
    <Star
      size={size}
      className={isFavorite ? 'fill-amber-400' : 'fill-none'}
    />
  </button>
);

export default StarButton;