// src/views/estimaTp/TpCadreTab.jsx
// ESTIMA TP — onglet « Cadre » : le bordereau reprend la forme du devis ESTIMA
// (chapitres / sous-chapitres imbriqués / articles, ƒ(x), glisser-déposer).
// Les infos générales sont dans la « Fiche affaire » (ruban → Infos) et l'import
// DPGF Excel dans le ruban → Données.
import React from 'react';
import { Info } from 'lucide-react';
import TpBordereau from './bordereau/TpBordereau';

export default function TpCadreTab({ study, setStudy, onOpenSousDetail, selectedId, onSelectId }) {
  const chapters = study?.cadre?.chapters || [];

  const setChapters = (next) =>
    setStudy(prev => ({ ...prev, cadre: { ...(prev?.cadre || {}), chapters: next } }));

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 bg-[#f5f5f7]">
      <div className="max-w-6xl mx-auto space-y-4">

        {chapters.length === 0 && (
          <div className="flex items-start gap-2 bg-orange-50/60 border border-orange-100 rounded-xl px-4 py-2.5">
            <Info size={14} className="text-orange-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-orange-700 leading-relaxed">
              Partez d'un <span className="font-bold">DPGF Excel</span> via <span className="font-bold">« Import DPGF »</span> dans le ruban,
              ou saisissez le bordereau à la main ci-dessous. Renseignez les informations de l'affaire via <span className="font-bold">« Infos »</span>.
            </p>
          </div>
        )}

        {/* Bordereau (forme ESTIMA) */}
        <TpBordereau chapters={chapters} onChange={setChapters} onOpenSousDetail={onOpenSousDetail} selectedId={selectedId} onSelectId={onSelectId} />
      </div>
    </div>
  );
}
