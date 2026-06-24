// src/views/estimaTp/sousDetail/TpAllResourcesModal.jsx
// ESTIMA TP — vue « toutes les ressources » d'un article : les 5 postes empilés et
// éditables. Rendu en overlay ABSOLU sur la zone d'édition (pas en fixed) → le volet
// Bibliothèque, à gauche de cette zone, reste visible et cliquable pour insérer des
// ressources. Cliquer l'en-tête coloré d'un poste filtre la bibliothèque sur ce poste.
import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { fmt } from './sdFormat';
import { ArticleMetaTiles } from './TpArticleMeta';
import { PosteTable } from './TpDetailTables';
import { emptyDetail, computeDetail, effectiveDuree, POSTES } from '../../../utils/tp/tpPriceCompute';

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
        {/* En-tête : titre + récap, tuiles Quantité / Rendt / Durée (éditables), fermer */}
        <div className="flex items-center justify-between gap-3 px-5 py-2.5 bg-white border-b border-gray-200/60 shrink-0">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-black text-slate-900 truncate">
              {item.designation || 'Article'} — toutes les ressources
            </h3>
            <p className="text-[11px] text-slate-500">
              Déboursé sec <span className="font-bold text-slate-700">{fmt(r.deboursecSec)}</span>
              <span className="text-blue-600 font-semibold"> · cliquez un en-tête pour filtrer la Bibliothèque ←</span>
            </p>
          </div>
          <ArticleMetaTiles unit={item.unit} qte={qte} rendement={detail.rendement} duree={duree}
            onQtyChange={(v) => onQtyChange?.(v)} onRendementChange={(v) => onChange({ ...detail, rendement: v })} />
          <button onClick={onClose} title="Fermer (Échap)"
            className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
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
