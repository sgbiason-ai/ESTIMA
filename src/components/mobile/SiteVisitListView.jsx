// src/components/mobile/SiteVisitListView.jsx
// Liste des visites de site — écran de sélection mobile.

import React, { useState } from 'react';
import Icon from './Icon';
import { dateFr } from './formatters';
import { confirm } from '../../utils/globalUI';

export default function SiteVisitListView({ visits, loading, onSelect, onCreate, onDelete, onRefresh, isLandscape }) {
  const [contextMenu, setContextMenu] = useState(null);
  return (
    <div className="pb-2">
      <div className="flex gap-2 px-4 pt-3 pb-2 mb-1">
        <div className="flex-1 bg-white rounded-xl p-3 border border-gray-200 text-center">
          <div className="text-xl font-bold text-gray-900">{visits.length}</div>
          <div className="text-[13px] text-gray-500 font-semibold">Visites</div>
        </div>
        <div className="flex-1 bg-white rounded-xl p-3 border border-gray-200 text-center">
          <div className="text-xl font-bold text-gray-900">
            {visits.filter(v => v.hasGps).length}
          </div>
          <div className="text-[13px] text-gray-500 font-semibold">Avec GPS</div>
        </div>
        <button onClick={onRefresh} className="bg-white rounded-xl p-3 border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition active:scale-[0.97]">
          <Icon name="refresh" size={18} color="#3b82f6" />
        </button>
      </div>

      {/* Bouton nouvelle visite */}
      <button
        onClick={onCreate}
        className="flex items-center justify-center gap-2 w-[calc(100%-2rem)] mx-4 mb-3 py-3 bg-gray-900 text-white rounded-xl text-[13px] font-bold active:scale-[0.97] transition"
      >
        <Icon name="plus" size={16} color="#fff" />
        Nouvelle visite
      </button>

      {loading && (
        <div className="flex items-center justify-center py-16 gap-2 text-gray-500">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Chargement…</span>
        </div>
      )}

      {!loading && visits.length > 0 && (
        <div className={isLandscape ? 'grid grid-cols-2 gap-2 px-4' : 'contents'}>
          {visits.map(v => {
            let pressTimer = null;
            return (
            <button key={v.id}
              onClick={() => { if (!contextMenu) onSelect(v); }}
              onTouchStart={(e) => {
                const touch = e.touches[0];
                pressTimer = setTimeout(() => setContextMenu({ visit: v, x: touch.clientX, y: touch.clientY }), 500);
              }}
              onTouchEnd={() => clearTimeout(pressTimer)}
              onTouchMove={() => clearTimeout(pressTimer)}
              onContextMenu={(e) => { e.preventDefault(); setContextMenu({ visit: v, x: e.clientX, y: e.clientY }); }}
              className={`block p-4 bg-white rounded-xl border border-gray-200 text-left transition hover:shadow-md active:scale-[0.98] select-none ${isLandscape ? '' : 'w-[calc(100%-2rem)] mx-4 mb-2'}`}>
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon name="chart" size={18} color="#059669" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-bold text-gray-900 leading-tight truncate">{v.nom || 'Visite sans nom'}</div>
                  {v.lieu && <div className="text-[13px] text-gray-500 font-medium mt-0.5 truncate">{v.lieu}</div>}
                  {v.client && <div className="text-[12px] text-gray-400 mt-0.5 truncate">{v.client}</div>}
                  <div className="flex items-center gap-2 mt-1.5 text-[13px] text-gray-500 font-semibold">
                    <span>{v.obsCount} obs.</span>
                    {v.hasGps && <span className="text-emerald-600">GPS</span>}
                    {v.date && (<><span className="text-gray-300">·</span><span>{dateFr(v.date)}</span></>)}
                    <span className="ml-auto"><Icon name="chevron" size={14} color="#d1d5db" /></span>
                  </div>
                </div>
              </div>
            </button>
            );
          })}
        </div>
      )}

      {/* Menu contextuel (appui long) */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div className="fixed z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 py-1 w-48 overflow-hidden"
            style={{ top: contextMenu.y + 8, left: Math.min(contextMenu.x, window.innerWidth - 200) }}>
            <button
              onClick={async () => {
                const v = contextMenu.visit;
                setContextMenu(null);
                const ok = await confirm(`Supprimer "${v.nom || 'Visite sans nom'}" ?`, { danger: true });
                if (ok) onDelete?.(v.id);
              }}
              className="flex items-center gap-3 w-full px-4 py-3 text-left text-[13px] font-medium text-red-500 hover:bg-red-50 active:bg-red-100 transition"
            >
              <Icon name="trash" size={16} color="#ef4444" />
              Supprimer cette visite
            </button>
            <button onClick={() => setContextMenu(null)}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-left text-[12px] font-medium text-gray-400 hover:bg-gray-50 transition border-t border-gray-100">
              Annuler
            </button>
          </div>
        </>
      )}

      {!loading && visits.length === 0 && (
        <div className="text-center py-10">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <Icon name="chart" size={24} color="#9ca3af" />
          </div>
          <p className="text-[13px] text-gray-500 font-medium">Aucune visite de site</p>
          <p className="text-[11px] text-gray-400 mt-1">Créez votre première visite terrain</p>
        </div>
      )}
    </div>
  );
}
