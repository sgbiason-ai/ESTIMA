// src/components/mobile/PlansListView.jsx
// Sous-menu Plans — liste des dossiers SharePoint par phase

import React from 'react';
import Icon from './Icon';

export default function PlansListView({ project }) {
  const plans = project?.sharepointPlans || [];
  // Rétrocompatibilité : si ancien champ unique sharepointUrl existe
  const legacyUrl = project?.sharepointUrl;
  const allPlans = plans.length > 0
    ? plans
    : legacyUrl ? [{ name: 'Plans', url: legacyUrl }] : [];

  if (allPlans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-4">
        <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
          <Icon name="map" size={24} color="#9ca3af" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">Aucun plan configuré</h2>
        <p className="text-sm text-gray-400 max-w-[260px] leading-relaxed">
          Configurez les dossiers de plans depuis la Fiche Projet sur le bureau.
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 py-3">
      <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-3">
        {allPlans.length} dossier{allPlans.length > 1 ? 's' : ''} de plans
      </div>
      {allPlans.map((plan, idx) => (
        <a
          key={idx}
          href={plan.url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 w-full py-3.5 border-b border-gray-100 text-left transition hover:bg-gray-50 active:bg-gray-100 active:scale-[0.98]"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <Icon name="map" size={20} color="#2563eb" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-bold text-gray-900">{plan.name || 'Plans'}</div>
            <div className="text-[11px] text-gray-400 mt-0.5 truncate">{plan.url}</div>
          </div>
          <Icon name="chevron" size={16} color="#d1d5db" />
        </a>
      ))}
    </div>
  );
}
