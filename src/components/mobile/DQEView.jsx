import React, { useState, useMemo } from 'react';
import Icon from './Icon';
import { fmt } from './formatters';
import { normalizeUnitSymbol } from '../../utils/helpers';

export default function DQEView({ project, calcHook, tranchesHook }) {
  const { tranches, hasTranches } = tranchesHook;
  const [activeTranche, setActiveTranche] = useState('global');
  const [expandedChap, setExpandedChap]   = useState({});

  const dqeData = useMemo(() => {
    const qtyMap = calcHook.clientQtyMaps?.[activeTranche] || calcHook.clientQtyMaps?.global || {};
    const chapters = [];
    let total = 0;

    // Parcours récursif : chaque chapitre/sous-chapitre devient une section "plate"
    // avec ses lignes directes uniquement. Le fil d'Ariane garde le contexte parent.
    const walk = (node, parents) => {
      if (node.type !== 'chapter') return;
      const lignes = [];
      let sousTotal = 0;

      (node.children || []).forEach(child => {
        if (child.type === 'item') {
          const qty = qtyMap[child.id] || 0;
          const pu = Number(child.price || 0);
          const lineTotal = qty * pu;
          if (qty !== 0 || pu !== 0) {
            lignes.push({
              id: child.id,
              ref: calcHook.refMap?.get(child.id) || '',
              designation: child.designation || '',
              unite: normalizeUnitSymbol(child.unit),
              qte: qty,
              pu,
              total: lineTotal,
            });
            sousTotal += lineTotal;
          }
        }
      });

      if (lignes.length > 0) {
        chapters.push({ nom: node.title || 'Sans titre', parents, lignes, sousTotal });
        total += sousTotal;
      }

      // Sous-chapitres → leurs propres sections (à plat), parent ajouté au fil d'Ariane
      (node.children || []).forEach(child => {
        if (child.type === 'chapter') walk(child, [...parents, node.title || 'Sans titre']);
      });
    };

    (project.chapters || []).forEach(ch => walk(ch, []));
    return { chapters, total };
  }, [project, activeTranche, calcHook]);

  const toggleChap = (idx) => {
    setExpandedChap(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <div className="py-2">
      {/* Total */}
      <div className="mx-4 mb-3 p-4 bg-white rounded-2xl border border-gray-200 text-center">
        <div className="text-xs text-gray-700 font-bold uppercase tracking-wider">DQE Total Client</div>
        <div className="text-2xl font-extrabold text-blue-600 mt-1">{fmt(dqeData.total)}</div>
        <div className="text-xs text-gray-700 mt-1">
          {dqeData.chapters.length} chapitres •{' '}
          {dqeData.chapters.reduce((s, c) => s + c.lignes.length, 0)} lignes
        </div>
      </div>

      {/* Tranche tabs */}
      {hasTranches && (
        <div className="flex gap-1.5 px-4 mb-3 overflow-x-auto">
          <button
            onClick={() => { setActiveTranche('global'); setExpandedChap({}); }}
            className={`px-3 py-2 rounded-lg border text-xs font-bold whitespace-nowrap transition ${
              activeTranche === 'global'
                ? 'bg-gray-900 border-gray-900 text-white shadow-sm'
                : 'bg-white border-gray-200 text-gray-600'
            }`}>
            Global
          </button>
          {tranches.map(t => (
            <button key={t.id}
              onClick={() => { setActiveTranche(t.id); setExpandedChap({}); }}
              className={`px-3 py-2.5 rounded-lg border text-xs font-bold whitespace-nowrap transition ${
                activeTranche === t.id
                  ? 'bg-gray-900 border-gray-900 text-white shadow-sm'
                  : 'bg-white border-gray-200 text-gray-600'
              }`}>
              {t.name}
            </button>
          ))}
        </div>
      )}

      {/* Chapitres */}
      {dqeData.chapters.map((chap, idx) => {
        const isOpen = expandedChap[idx];
        const pct = dqeData.total > 0 ? ((chap.sousTotal / dqeData.total) * 100).toFixed(1) : '0';
        return (
          <div key={idx} className="mx-4 mb-1.5">
            <button onClick={() => toggleChap(idx)}
              className={`flex items-center gap-2 w-full p-3 bg-white border border-gray-200 text-left ${isOpen ? 'rounded-t-xl' : 'rounded-xl'}`}>
              <div className="flex-1 min-w-0">
                {chap.parents?.length > 0 && (
                  <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wide truncate">
                    {chap.parents.join(' › ')}
                  </div>
                )}
                <div className="text-[13px] font-bold text-gray-900 uppercase">{chap.nom}</div>
                <div className="text-[11px] text-gray-700 mt-0.5">{chap.lignes.length} ligne{chap.lignes.length > 1 ? 's' : ''} • {pct}%</div>
              </div>
              <span className="text-sm font-extrabold text-gray-900">{fmt(chap.sousTotal)}</span>
              <span className={`transition-transform ${isOpen ? 'rotate-90' : ''}`}>
                <Icon name="chevron" size={14} color="#64748b" />
              </span>
            </button>

            {isOpen && (
              <div className="bg-white border border-t-0 border-gray-200 rounded-b-xl overflow-hidden">
                {/* En-tête de colonnes */}
                <div className="grid grid-cols-[1fr_24px_46px_48px_62px] gap-1 px-2.5 py-1.5 bg-gray-50 text-[9px] font-extrabold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                  <span>Désignation</span>
                  <span className="text-center">U</span>
                  <span className="text-right">Qté</span>
                  <span className="text-right">PU €</span>
                  <span className="text-right">Total €</span>
                </div>
                {chap.lignes.map((l, lIdx) => (
                  <div key={lIdx} className="grid grid-cols-[1fr_24px_46px_48px_62px] gap-1 px-2.5 py-2 border-b border-gray-100 items-start">
                    <div className="min-w-0 leading-snug break-words" title={l.designation}>
                      <span className="text-[10px] text-blue-600 font-bold tabular-nums mr-1">{l.ref}</span>
                      <span className="text-[11px] text-gray-900 font-medium">{l.designation}</span>
                    </div>
                    <div className="text-center text-[11px] font-bold text-gray-900">{l.unite}</div>
                    <div className="text-right text-[11px] font-bold text-gray-900 tabular-nums whitespace-nowrap">{l.qte.toLocaleString('fr-FR')}</div>
                    <div className="text-right text-[11px] font-bold text-gray-900 tabular-nums whitespace-nowrap">{l.pu.toLocaleString('fr-FR', { minimumFractionDigits: 0 })}</div>
                    <div className="text-right text-[11px] font-bold text-gray-900 tabular-nums whitespace-nowrap">{l.total.toLocaleString('fr-FR', { minimumFractionDigits: 0 })}</div>
                  </div>
                ))}
                {/* Sous-total */}
                <div className="flex justify-between px-3 py-2.5 bg-white border-t border-gray-200">
                  <span className="text-xs font-bold text-gray-700">Sous-total</span>
                  <span className="text-[13px] font-extrabold text-blue-600">{fmt(chap.sousTotal)}</span>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Footer total */}
      <div className="flex justify-between mx-4 mt-2 mb-4 p-4 bg-gray-900 rounded-xl">
        <span className="text-sm font-bold text-white">Total DQE</span>
        <span className="text-lg font-extrabold text-white">{fmt(dqeData.total)}</span>
      </div>
    </div>
  );
}
