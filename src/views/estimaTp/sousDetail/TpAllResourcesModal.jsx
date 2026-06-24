// src/views/estimaTp/sousDetail/TpAllResourcesModal.jsx
// ESTIMA TP — vue « toutes les ressources » d'un article : les 5 postes empilés et
// éditables. Rendu en overlay ABSOLU sur la zone d'édition (pas en fixed) → le volet
// Bibliothèque, à gauche de cette zone, reste visible et cliquable pour insérer des
// ressources. Cliquer l'en-tête coloré d'un poste filtre la bibliothèque sur ce poste.
import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { fmt, fmt2 } from './sdFormat';
import { ArticleMetaTiles } from './TpArticleMeta';
import { PosteTable } from './TpDetailTables';
import { emptyDetail, computeDetail, effectiveDuree, effectiveRendement, POSTES } from '../../../utils/tp/tpPriceCompute';

export default function TpAllResourcesModal({ item, coef, activePoste, onSelectPoste, onChange, onQtyChange, onClose }) {
  const detail = item.detail || emptyDetail();
  const qte = Number(item.qty || 0);
  const r = computeDetail(detail, qte, coef);
  const duree = effectiveDuree(detail, qte);
  const setBlock = (key) => (lines) => onChange({ ...detail, [key]: lines });

  // Fermeture sur Échap.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="absolute inset-0 z-40 flex p-3 bg-black/30 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="flex-1 min-w-0 bg-[#f5f5f7] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}>
        {/* En-tête : titre + encadrés (déboursé sec + Quantité/Rendt/Durée éditables) */}
        <div className="px-5 py-3 bg-white border-b border-gray-200/60 shrink-0">
          {/* Ligne 1 : badge + désignation + fermer */}
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <div className="min-w-0 flex items-center gap-2">
              <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-600 text-white text-[9px] font-black uppercase tracking-widest">Article</span>
              <h3 className="min-w-0 text-sm font-black text-slate-900 truncate">{item.designation || 'Article sans nom'}</h3>
              <span className="shrink-0 text-[10px] font-semibold text-slate-400 hidden sm:inline">— toutes les ressources</span>
            </div>
            <button onClick={onClose} title="Fermer (Échap)"
              className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-gray-100 transition-colors">
              <X size={18} />
            </button>
          </div>
          {/* Ligne 2 : encadrés métriques */}
          <div className="flex items-stretch gap-2 flex-wrap">
            {/* Déboursé sec — PU en avant, total dessous */}
            <div className="shrink-0 flex flex-col justify-center rounded-lg border border-slate-200 bg-white px-3 py-1 min-w-[124px]">
              <span className="text-[8px] font-bold uppercase tracking-wide text-slate-500">Déboursé sec</span>
              <span className="flex items-baseline gap-1">
                <span className="text-xl font-mono font-black text-slate-900 leading-none">{fmt2(r.puSec)}</span>
                <span className="text-[9px] font-semibold text-slate-400">/{item.unit}</span>
              </span>
              <span className="text-[9px] font-mono font-semibold text-slate-500">total {fmt(r.deboursecSec)}</span>
            </div>
            <ArticleMetaTiles unit={item.unit} qte={qte} rendement={effectiveRendement(detail, qte)} duree={duree}
              dureeForced={detail.dureeForced} onQtyChange={(v) => onQtyChange?.(v)} onPatch={(p) => onChange({ ...detail, ...p })} />
          </div>
        </div>
        {/* Corps : 5 postes empilés, en-têtes colorés cliquables */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {POSTES.map(p => (
            <PosteTable key={p} poste={p} detail={detail} onChangeBlock={setBlock}
              qte={qte} duree={duree} articleUnit={item.unit}
              onHeaderClick={() => onSelectPoste?.(p)} active={p === activePoste} collapseEmpty />
          ))}
        </div>
      </div>
    </div>
  );
}
