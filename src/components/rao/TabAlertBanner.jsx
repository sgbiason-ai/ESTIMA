// src/components/rao/TabAlertBanner.jsx
// Bandeau ambre qui liste les items à compléter dans un onglet RAO.
// Cliquable → scroll automatique vers l'item dans la page.

import React, { useState } from 'react';
import { AlertTriangle, ChevronRight, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';

const TabAlertBanner = ({ missing = [], onItemClick, label = 'éléments à compléter' }) => {
  const [collapsed, setCollapsed] = useState(false);
  const total = missing.length;

  // Si rien à compléter : message de succès discret
  if (total === 0) {
    return (
      <div className="mb-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-700">
        <CheckCircle2 size={14} className="text-emerald-500" />
        Cet onglet est complet.
      </div>
    );
  }

  // Groupement par companyName si pertinent
  const grouped = {};
  const noGroup = [];
  missing.forEach(it => {
    if (it.companyName) {
      grouped[it.companyName] = grouped[it.companyName] || [];
      grouped[it.companyName].push(it);
    } else {
      noGroup.push(it);
    }
  });
  const groupedKeys = Object.keys(grouped);

  const handleItemClick = (item) => {
    // Tente de scroller vers l'élément si un anchorId est fourni
    if (item.anchorId) {
      requestAnimationFrame(() => {
        const el = document.getElementById(item.anchorId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Effet de surbrillance momentanée
          el.classList.add('rao-highlight-pulse');
          setTimeout(() => el.classList.remove('rao-highlight-pulse'), 2000);
        }
      });
    }
    if (onItemClick) onItemClick(item);
  };

  return (
    <div className="mb-4 rounded-xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-amber-100/40 shadow-sm overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-amber-100/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-amber-200 text-amber-700">
            <AlertTriangle size={14} strokeWidth={2.5} />
          </div>
          <span className="text-xs font-black text-amber-900 uppercase tracking-wide">
            {total} {label}{total > 1 ? 's' : ''} dans cet onglet
          </span>
        </div>
        {collapsed ? <ChevronDown size={16} className="text-amber-700" /> : <ChevronUp size={16} className="text-amber-700" />}
      </button>

      {/* Liste détaillée */}
      {!collapsed && (
        <div className="px-4 pb-3 space-y-2">
          {/* Items groupés par entreprise */}
          {groupedKeys.map(name => (
            <div key={name} className="bg-white/60 rounded-lg border border-amber-200 overflow-hidden">
              <div className="px-3 py-1.5 bg-amber-100/50 border-b border-amber-200">
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-800">{name}</span>
                <span className="ml-2 text-[10px] font-bold text-amber-600">{grouped[name].length} item{grouped[name].length > 1 ? 's' : ''}</span>
              </div>
              <div className="divide-y divide-amber-100">
                {grouped[name].map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleItemClick(item)}
                    className="w-full flex items-center justify-between gap-3 px-3 py-1.5 hover:bg-amber-50 transition-colors text-left"
                  >
                    <span className="text-[11px] font-medium text-amber-900 flex-1">{item.label.replace(` pour ${name}`, '')}</span>
                    <ChevronRight size={12} className="text-amber-500 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          ))}
          {/* Items non groupés (configuration générale) */}
          {noGroup.length > 0 && (
            <div className="bg-white/60 rounded-lg border border-amber-200 divide-y divide-amber-100">
              {noGroup.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleItemClick(item)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-1.5 hover:bg-amber-50 transition-colors text-left"
                >
                  <span className="text-[11px] font-medium text-amber-900 flex-1">{item.label}</span>
                  <ChevronRight size={12} className="text-amber-500 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TabAlertBanner;
