// src/views/estimaTp/sousDetail/TpSousDetailTab.jsx
// ESTIMA TP — onglet « Sous-détail » : barre latérale « Bibliothèque » à gauche
// (façon ESTIMA), sélecteur d'articles compact en haut, éditeur en dessous.
// Le PU retenu calculé est réinjecté dans le PU de l'article au bordereau.
import React, { useMemo, useState } from 'react';
import { Coins, FileWarning } from 'lucide-react';
import { findNode, updateNode } from '../bordereau/tpBordereauModel';
import {
  computeDetail, emptyDetail, defaultCoefficients,
  newRessourceLine, newTransportLine, newFournitureLine, newSousTraitanceLine,
} from '../../../utils/tp/tpPriceCompute';
import { useTpResources } from '../../../hooks/useTpResources';
import { flattenArticles } from './sdFormat';
import TpSousDetailEditor from './TpSousDetailEditor';
import TpLibraryPanel from '../ressources/TpLibraryPanel';

// Construit une ligne de sous-détail à partir d'une ressource de bibliothèque (sans code).
function lineFromResource(res) {
  const c = { designation: res.designation, unit: res.unit };
  switch (res.category) {
    case 'materiel':
    case 'mo':
      return [res.category, newRessourceLine({ ...c, unit: res.unit || 'J', puJour: res.puJour, amort: res.amort, entret: res.entret, cons: res.cons, loc: res.loc })];
    case 'transport':
      return ['transport', newTransportLine({ ...c, unit: res.unit || 'J', puJour: res.puJour, amort: res.amort, entret: res.entret, cons: res.cons, loc: res.loc })];
    case 'fourniture':
      return ['fourniture', newFournitureLine({ ...c, unit: res.unit || 'T', epaisseur: res.epaisseur, densite: res.densite, puBareme: res.puBareme })];
    case 'soustraitance':
      return ['soustraitance', newSousTraitanceLine({ ...c, unit: res.unit || 'U', puBareme: res.puBareme })];
    default:
      return [null, null];
  }
}

export default function TpSousDetailTab({ study, setStudy, companyId }) {
  const chapters = useMemo(() => study?.cadre?.chapters || [], [study?.cadre?.chapters]);
  const coef = study?.coefficients || defaultCoefficients();
  const articles = useMemo(() => flattenArticles(chapters), [chapters]);
  const [selectedId, setSelectedId] = useState(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [activePoste, setActivePoste] = useState(null);
  const { resources } = useTpResources(companyId);

  const currentId = selectedId && articles.some(a => a.id === selectedId) ? selectedId : (articles[0]?.id || null);
  const selectedItem = currentId ? findNode(chapters, currentId) : null;

  const applyDetail = (nextDetail) => {
    const item = findNode(chapters, currentId);
    if (!item) return;
    const { puRetenu } = computeDetail(nextDetail, Number(item.qty || 0), coef, item.unit);
    const next = updateNode(chapters, currentId, { detail: nextDetail, price: puRetenu });
    setStudy(prev => ({ ...prev, cadre: { ...(prev?.cadre || {}), chapters: next } }));
  };

  // Quantité d'ouvrage éditable depuis le sous-détail : met à jour l'article du
  // bordereau (on retire la formule de quantité éventuelle) + recalcule le PU.
  const applyQty = (newQty) => {
    const item = findNode(chapters, currentId);
    if (!item) return;
    const detail = item.detail || emptyDetail();
    const { puRetenu } = computeDetail(detail, newQty, coef, item.unit);
    const next = updateNode(chapters, currentId, { qty: Number(newQty) || 0, formula: '', price: puRetenu });
    setStudy(prev => ({ ...prev, cadre: { ...(prev?.cadre || {}), chapters: next } }));
  };

  const insertFromLibrary = (res) => {
    if (!selectedItem) return;
    const [block, line] = lineFromResource(res);
    if (!block) return;
    const detail = selectedItem.detail || emptyDetail();
    applyDetail({ ...detail, [block]: [...(detail[block] || []), line] });
  };

  if (articles.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6 bg-[#f5f5f7]">
        <div className="p-4 rounded-2xl bg-orange-50 mb-4"><FileWarning size={28} className="text-orange-500" strokeWidth={1.5} /></div>
        <p className="text-sm font-semibold text-slate-700">Aucun article à chiffrer</p>
        <p className="text-xs text-slate-400 mt-1 max-w-sm">Ajoutez d'abord des articles dans l'onglet <strong>Cadre</strong>, puis revenez ici pour construire leur sous-détail de prix.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex min-h-0 bg-[#f5f5f7]">
      {/* Volet bibliothèque (gauche, façon ESTIMA) — filtre suit le bloc actif */}
      {libraryOpen && (
        <TpLibraryPanel resources={resources} onInsert={insertFromLibrary} onClose={() => setLibraryOpen(false)} activeCategory={activePoste} />
      )}

      <div className="flex-1 flex flex-col min-h-0">
        {/* Sélecteur d'articles compact (horizontal) */}
        <div className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-white border-b border-slate-200 overflow-x-auto">
          {articles.map(a => {
            const active = a.id === currentId;
            return (
              <button key={a.id} onClick={() => setSelectedId(a.id)}
                title={a.designation}
                className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all ${active ? 'bg-orange-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                <span className={`text-[10px] font-mono font-bold ${active ? 'text-orange-100' : 'text-slate-400'}`}>{a.num}</span>
                <span className="font-semibold max-w-[140px] truncate">{a.designation || 'Sans nom'}</span>
                {a.hasDetail && <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-300' : 'bg-emerald-500'}`} />}
              </button>
            );
          })}
        </div>

        {/* Éditeur */}
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {selectedItem
            ? <TpSousDetailEditor
                item={{ ...selectedItem, detail: selectedItem.detail || emptyDetail() }}
                coef={coef} onChange={applyDetail} onQtyChange={applyQty}
                libraryOpen={libraryOpen} onToggleLibrary={() => setLibraryOpen(o => !o)}
                onActivePoste={setActivePoste} />
            : <div className="flex items-center justify-center h-full text-slate-400"><Coins size={20} className="mr-2" /> Sélectionnez un article</div>}
        </div>
      </div>
    </div>
  );
}
