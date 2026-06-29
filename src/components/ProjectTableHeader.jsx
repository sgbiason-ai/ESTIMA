// src/components/ProjectTableHeader.jsx
// Tête de tableau (sticky) de l'écran Estimation. Reprend EXACTEMENT les largeurs de
// colonnes des lignes (ItemList) pour rester aligné quel que soit le niveau d'imbrication
// (seule la désignation s'indente). Les libellés s'adaptent au mode :
//  • Étude (viewMode 'study')  : Qté réelle + colonne secondaire « Qté à valoir »
//  • Rendu (viewMode 'client') : Qté à valoir (la colonne secondaire disparaît)
import React from 'react';

const ProjectTableHeader = ({ viewMode = 'study', showRendu = false }) => {
  const isRendu = viewMode === 'client';
  const qtyMainLabel = isRendu ? 'Qté rendu' : 'Qté réelle';
  // Colonne secondaire « Qté à valoir » présente uniquement en vue Étude.
  const showSecondaryQty = showRendu && !isRendu;

  return (
    <div className="sticky top-0 z-10 flex items-center px-4 py-1 bg-slate-100/95 backdrop-blur-sm border-b border-slate-200 rounded-t-xl text-[10px] font-black uppercase tracking-widest text-slate-500 select-none">
      {/* Chrome (checkbox + poignée) — espaceurs alignés sur les lignes */}
      <div className="w-6 shrink-0" />
      <div className="w-8 shrink-0" />
      {/* N° prix */}
      <div className="w-16 text-center shrink-0">N° prix</div>
      {/* Désignation (absorbe l'indentation des sous-chapitres) */}
      <div className="flex-1 px-2 min-w-0">Désignation</div>
      {/* Indicateurs formule/source */}
      <div className="w-10 shrink-0" />
      {/* Unité */}
      <div className="w-16 text-center shrink-0">Unité</div>
      {/* Quantité principale */}
      <div className="w-24 text-right px-2 shrink-0">{qtyMainLabel}</div>
      {/* Quantité à valoir (secondaire, vue Étude) */}
      {showSecondaryQty && <div className="w-20 text-right px-1.5 shrink-0 text-indigo-500">Qté rendu</div>}
      {/* Prix unitaire */}
      <div className="w-32 text-right px-2 shrink-0">P.U. (€)</div>
      {/* Total rendu */}
      <div className="w-28 text-right px-3 shrink-0">Total rendu</div>
      {/* Spacer de fin (aligné sur les lignes) */}
      <div className="w-10 shrink-0" />
    </div>
  );
};

export default ProjectTableHeader;
