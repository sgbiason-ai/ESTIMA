// src/views/estimaTp/TpCadreTab.jsx
// ESTIMA TP — onglet « Cadre » : le bordereau reprend la forme du devis ESTIMA
// (chapitres / sous-chapitres imbriqués / articles, ƒ(x), glisser-déposer).
import React from 'react';
import TpBordereau from './bordereau/TpBordereau';

export default function TpCadreTab({ study, setStudy }) {
  const chapters = study?.cadre?.chapters || [];

  const setChapters = (next) =>
    setStudy(prev => ({ ...prev, cadre: { ...(prev?.cadre || {}), chapters: next } }));

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 bg-[#f5f5f7]">
      <div className="max-w-6xl mx-auto space-y-5">

        {/* Infos générales de l'étude */}
        <div className="bg-white border border-gray-200/60 rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Nom de l'étude" value={study?.name || ''}
            onChange={v => setStudy(p => ({ ...p, name: v }))} placeholder="Ex : Aménagement RD820" />
          <Field label="Référence / N° AO" value={study?.reference || ''}
            onChange={v => setStudy(p => ({ ...p, reference: v }))} placeholder="Ex : 2026-AO-014" />
          <Field label="Maître d'ouvrage" value={study?.maitreOuvrage || ''}
            onChange={v => setStudy(p => ({ ...p, maitreOuvrage: v }))} placeholder="Ex : CD31" />
        </div>

        {/* Bordereau (forme ESTIMA) */}
        <TpBordereau chapters={chapters} onChange={setChapters} />
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</span>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-gray-100 border border-gray-200/60 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
      />
    </label>
  );
}
